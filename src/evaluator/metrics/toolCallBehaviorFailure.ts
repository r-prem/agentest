import { z } from 'zod'
import { QualitativeMetric, type ScoreInput, type QualResult } from './base.js'
import {
  TOOL_CALL_BEHAVIOR_FAILURE_PROMPT,
  renderPrompt,
  formatHistory,
  formatToolCallSignatures,
  formatToolResults,
  wrapContent,
} from '../prompts.js'

export const TOOL_CALL_BEHAVIOR_LABELS = [
  'no failure',
  'unnecessary tool call',
  'wrong tool',
  'wrong arguments',
  'ignored tool result',
  'missing tool call',
  'repeated tool call',
] as const

export type ToolCallBehaviorLabel = (typeof TOOL_CALL_BEHAVIOR_LABELS)[number]

const schema = z.object({
  label: z.enum(TOOL_CALL_BEHAVIOR_LABELS),
  reason: z.string(),
})

export class ToolCallBehaviorFailureMetric extends QualitativeMetric {
  readonly name = 'tool_call_behavior_failure'

  async evaluate(input: ScoreInput): Promise<QualResult> {
    const prompt = renderPrompt(TOOL_CALL_BEHAVIOR_FAILURE_PROMPT, {
      goal: wrapContent('goal', input.goal),
      profile: wrapContent('profile', input.profile),
      history: formatHistory(input.history),
      userMessage: wrapContent('user-message', input.userMessage),
      agentMessage: wrapContent('agent-message', input.agentMessage),
      toolCalls: formatToolCallSignatures(input.toolCalls),
      toolResults: formatToolResults(input.toolCalls),
    })

    const result = await this.llm.generateObject({
      schema,
      messages: [{ role: 'user', content: prompt }],
    })

    return { value: result.object.label, reason: result.object.reason }
  }
}
