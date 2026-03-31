import { randomUUID } from 'node:crypto'
import type { AgentestConfig } from '../config/schema.js'
import type { Scenario, ToolCallRecord, CustomHandlerContext } from '../scenario/types.js'
import type { ToolMockFn } from '../scenario/types.js'
import { MockResolver, AgentestError } from '../scenario/mocks.js'
import { AgentClient, type ChatMessage, type ToolCall } from './agentClient.js'
import { SimulatedUser } from './simulatedUser.js'
import type { LLMProvider } from '../llm/provider.js'

export interface TurnRecord {
  turnIndex: number
  userMessage: string
  agentMessage: string
  toolCalls: ToolCallRecord[]
}

export interface ConversationRecord {
  conversationId: string
  turns: TurnRecord[]
  error?: string
}

export interface SimulationResult {
  scenario: Scenario
  conversations: ConversationRecord[]
}

export type SimulatorProgressCallback = (event: {
  scenario: string
  conversationId: string
  turn: number
  maxTurns: number
  phase: 'user-message' | 'agent-call' | 'tool-resolution'
}) => void

function sanitizeJson(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    clean[key] = sanitizeValue(value)
  }
  return clean
}

function sanitizeValue(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(sanitizeValue)
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    clean[key] = sanitizeValue(value)
  }
  return clean
}

export class Simulator {
  private agentClient: AgentClient
  private config: AgentestConfig
  onProgress?: SimulatorProgressCallback

  constructor(
    config: AgentestConfig,
    private llmProvider: LLMProvider,
  ) {
    this.config = config
    this.agentClient = new AgentClient(config)
  }

  async runScenario(scenario: Scenario): Promise<SimulationResult> {
    const isScripted = Array.isArray(scenario.options.turns) && scenario.options.turns.length > 0
    const conversationCount =
      scenario.options.conversationsPerScenario ??
      (isScripted ? 1 : this.config.conversationsPerScenario)
    const conversations: ConversationRecord[] = []

    // Resolve per-scenario agent override
    let agentClient = this.agentClient
    if (scenario.options.agent) {
      const namedAgent = this.config.agents?.[scenario.options.agent]
      if (!namedAgent) {
        throw new Error(
          `Scenario "${scenario.name}" references agent "${scenario.options.agent}" ` +
            `but no such agent was found in config.agents. ` +
            `Available agents: ${this.config.agents ? Object.keys(this.config.agents).join(', ') : '(none)'}`,
        )
      }
      agentClient = new AgentClient({
        ...this.config,
        agent: namedAgent,
      })
    }

    for (let i = 0; i < conversationCount; i++) {
      const conversationId = `conv-${i + 1}-${randomUUID().slice(0, 8)}`
      const record = await this.runConversation(scenario, conversationId, agentClient)
      conversations.push(record)
    }

    return { scenario, conversations }
  }

  private async runConversation(
    scenario: Scenario,
    conversationId: string,
    agentClient?: AgentClient,
  ): Promise<ConversationRecord> {
    const isScripted = Array.isArray(scenario.options.turns) && scenario.options.turns.length > 0
    const scriptedTurns = scenario.options.turns
    const maxTurns = isScripted
      ? scriptedTurns!.length
      : (scenario.options.maxTurns ?? this.config.maxTurns)
    const simulatedUser = isScripted ? null : new SimulatedUser(this.llmProvider, scenario.options)
    const mockResolver = new MockResolver(
      scenario.options.mocks?.tools as Record<string, ToolMockFn> | undefined,
      this.config.unmockedTools,
      scenario.name,
      conversationId,
    )
    mockResolver.reset()

    const client = agentClient ?? this.agentClient
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    const agentMessages: ChatMessage[] = []
    const turns: TurnRecord[] = []

    try {
      for (let turnIndex = 0; turnIndex < maxTurns; turnIndex++) {
        // 1. Get the next user message
        let userMessage: string
        let shouldStop = false

        if (isScripted) {
          userMessage = scriptedTurns![turnIndex].userMessage
        } else {
          this.onProgress?.({
            scenario: scenario.name,
            conversationId,
            turn: turnIndex + 1,
            maxTurns,
            phase: 'user-message',
          })
          const userResponse = await simulatedUser!.generateMessage(conversationHistory)

          // On subsequent turns, if the simulated user signals stop *before*
          // sending a new message, the goal is already met — end the conversation.
          if (userResponse.shouldStop && turnIndex > 0) {
            break
          }

          userMessage = userResponse.message
          shouldStop = userResponse.shouldStop
        }

        conversationHistory.push({ role: 'user', content: userMessage })
        agentMessages.push({ role: 'user', content: userMessage })

        // 2. Send to agent and handle tool call loop
        const turnToolCalls: ToolCallRecord[] = []
        let agentFinalText = ''

        // Set up context for custom handler (provides resolveTool for in-process agents)
        const contextToolCalls: ToolCallRecord[] = []
        const handlerCtx: CustomHandlerContext = {
          resolveTool: async (name, args) => {
            const resolved = await mockResolver.resolve(name, args, turnIndex)
            contextToolCalls.push({ name, args, result: resolved.result, turnIndex })
            return resolved.result
          },
          turnIndex,
          conversationId,
          scenarioName: scenario.name,
        }
        client.setHandlerContext(handlerCtx)

        this.onProgress?.({
          scenario: scenario.name,
          conversationId,
          turn: turnIndex + 1,
          maxTurns,
          phase: 'agent-call',
        })
        const MAX_TOOL_CALL_ROUNDS = 50
        let toolCallRound = 0
        let response = await client.send(agentMessages)

        // Tool call loop — keep going until agent returns text without tool calls
        while (response.hasToolCalls) {
          if (++toolCallRound > MAX_TOOL_CALL_ROUNDS) {
            throw new AgentestError(
              `Agent exceeded ${MAX_TOOL_CALL_ROUNDS} tool call rounds in a single turn`,
              {
                scenario: scenario.name,
                conversationId,
                turnIndex,
              },
            )
          }
          // Add the assistant message with tool calls to history
          agentMessages.push(response.message)

          // Resolve each tool call through mocks
          const toolResults = await this.resolveToolCalls(
            response.toolCalls,
            mockResolver,
            turnIndex,
            turnToolCalls,
          )

          // Add tool results to messages
          for (const toolResult of toolResults) {
            agentMessages.push(toolResult)
          }

          // Send back to agent with tool results
          response = await client.send(agentMessages)
        }

        // Agent returned a text response (no tool calls)
        agentFinalText = response.message.content ?? ''
        agentMessages.push(response.message)
        conversationHistory.push({ role: 'assistant', content: agentFinalText })

        // Merge tool calls resolved via ctx.resolveTool (custom handler in-process mocks)
        turnToolCalls.push(...contextToolCalls)

        turns.push({
          turnIndex,
          userMessage,
          agentMessage: agentFinalText,
          toolCalls: turnToolCalls,
        })

        // On turn 0 the user signalled stop with their first message — now
        // that the agent has replied once, honour that signal and end.
        if (shouldStop) {
          break
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof AgentestError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)

      return { conversationId, turns, error: errorMessage }
    }

    return { conversationId, turns }
  }

  private async resolveToolCalls(
    toolCalls: ToolCall[],
    mockResolver: MockResolver,
    turnIndex: number,
    turnToolCalls: ToolCallRecord[],
  ): Promise<ChatMessage[]> {
    const results: ChatMessage[] = []

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = sanitizeJson(JSON.parse(tc.function.arguments))
      } catch {
        console.warn(
          `[agentest] Failed to parse tool call arguments for "${tc.function.name}", defaulting to {}`,
        )
        args = {}
      }

      let result: unknown
      try {
        const resolved = await mockResolver.resolve(tc.function.name, args, turnIndex)
        result = resolved.result
      } catch (error) {
        if (error instanceof AgentestError) {
          throw error
        }
        // Mock threw an error — inject error result for agent to handle
        result = {
          error: error instanceof Error ? error.message : String(error),
        }
      }

      turnToolCalls.push({
        name: tc.function.name,
        args,
        result,
        turnIndex,
      })

      results.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }

    return results
  }
}
