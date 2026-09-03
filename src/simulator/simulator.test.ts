import { describe, expect, it } from 'vitest'
import type { AgentestConfig } from '../config/schema.js'
import type { LLMProvider } from '../llm/provider.js'
import type { Scenario } from '../scenario/types.js'
import { Simulator } from './simulator.js'

/**
 * An unmocked tool must fail the CONVERSATION, not leak into it.
 *
 * `unmockedTools: 'error'` makes MockResolver throw a clear, actionable error. That
 * works when agentest itself drives the tool loop. It does NOT work for a
 * `type: 'custom'` agent, because the throw surfaces inside the consumer's own tool
 * implementation — and agent frameworks catch tool errors on purpose so the model can
 * recover from a genuinely failing tool. LangGraph's ToolNode does this by default.
 *
 * The consumer's framework cannot tell "the API is down" from "this test is
 * misconfigured", so it swallows our error, hands it to the model as an ordinary tool
 * result, and the model politely works around it. Two bad outcomes followed:
 *
 *   1. FAKE FAILURE — the conversation limps on and the scenario reports whatever it
 *      noticed downstream ("missing: generate_chart"), which reads exactly like a real
 *      regression in the consumer's product.
 *   2. VACUOUS PASS — a `forbidden` assertion passes because the conversation aborted
 *      before the forbidden tool could ever have been called. Green, and proves nothing.
 *
 * Both were hit repeatedly in a downstream project before the cause was found. The fix
 * is to stop depending on the throw surviving: the resolver RECORDS every unmocked call,
 * and the simulator fails the conversation afterwards on the record alone.
 */

function makeConfig(handler: unknown): AgentestConfig {
  return {
    agent: { type: 'custom', handler },
    unmockedTools: 'error',
    maxTurns: 5,
    conversationsPerScenario: 1,
  } as unknown as AgentestConfig
}

const noLLM = {} as LLMProvider

function scenario(mocks?: Record<string, unknown>): Scenario {
  return {
    name: 'unmocked-tool',
    options: {
      turns: [{ userMessage: 'chart the speed of FALCON' }],
      ...(mocks ? { mocks: { tools: mocks } } : {}),
    },
  } as unknown as Scenario
}

describe('Simulator — unmocked tools fail the conversation', () => {
  it('fails the conversation even when the handler SWALLOWS the error', async () => {
    // Exactly what LangGraph's ToolNode does: catch, and let the agent carry on.
    const swallowingHandler = async (_messages: unknown, ctx: { resolveTool: Function }) => {
      try {
        await ctx.resolveTool('resolve_vehicle', { identifiers: 'FALCON' })
      } catch {
        /* swallowed, exactly as a tool-error middleware would */
      }
      return { role: 'assistant', content: 'I was unable to look that up.' }
    }

    const sim = new Simulator(makeConfig(swallowingHandler), noLLM)
    const result = await sim.runScenario(scenario())

    const conv = result.conversations[0]
    expect(conv.error).toBeDefined()
    // Must name the CAUSE, not a downstream symptom.
    expect(conv.error).toContain('resolve_vehicle')
    expect(conv.error).toContain('unmocked')
  })

  it('still fails when the handler swallows AND returns a plausible answer', async () => {
    // The vacuous-pass shape: nothing looks wrong from the outside.
    const handler = async (_m: unknown, ctx: { resolveTool: Function }) => {
      try {
        await ctx.resolveTool('generate_chart', {})
      } catch {
        /* swallowed */
      }
      return { role: 'assistant', content: 'Here is your chart.' }
    }

    const sim = new Simulator(makeConfig(handler), noLLM)
    const conv = (await sim.runScenario(scenario())).conversations[0]

    expect(conv.error).toBeDefined()
    expect(conv.error).toContain('generate_chart')
  })

  it('does NOT fail a conversation whose tools are all mocked', async () => {
    const handler = async (_m: unknown, ctx: { resolveTool: Function }) => {
      const r = await ctx.resolveTool('resolve_vehicle', { identifiers: 'FALCON' })
      return { role: 'assistant', content: JSON.stringify(r) }
    }

    const sim = new Simulator(makeConfig(handler), noLLM)
    const conv = (
      await sim.runScenario(scenario({ resolve_vehicle: () => ({ serial: '11223344' }) }))
    ).conversations[0]

    expect(conv.error).toBeUndefined()
    expect(conv.turns).toHaveLength(1)
    expect(conv.turns[0].toolCalls.map((t) => t.name)).toEqual(['resolve_vehicle'])
  })

  it('names each distinct missing mock once, however often it was called', async () => {
    const handler = async (_m: unknown, ctx: { resolveTool: Function }) => {
      for (const name of ['resolve_vehicle', 'resolve_vehicle', 'generate_chart']) {
        try {
          await ctx.resolveTool(name, {})
        } catch {
          /* swallowed */
        }
      }
      return { role: 'assistant', content: 'done' }
    }

    const conv = (await new Simulator(makeConfig(handler), noLLM).runScenario(scenario()))
      .conversations[0]

    expect(conv.error).toContain('resolve_vehicle')
    expect(conv.error).toContain('generate_chart')
    // The repeated tool must not be listed again as if it were a second problem.
    expect(conv.error).not.toMatch(/Also unmocked[^\n]*resolve_vehicle/)
  })

  it('does not fail when unmockedTools is passthrough', async () => {
    const handler = async (_m: unknown, ctx: { resolveTool: Function }) => {
      await ctx.resolveTool('anything', {})
      return { role: 'assistant', content: 'ok' }
    }

    const config = makeConfig(handler)
    ;(config as { unmockedTools: string }).unmockedTools = 'passthrough'
    const conv = (await new Simulator(config, noLLM).runScenario(scenario())).conversations[0]

    expect(conv.error).toBeUndefined()
  })
})
