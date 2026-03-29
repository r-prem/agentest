import { z } from 'zod'
import { QuantitativeMetric, type ScoreInput, type QuantResult } from './base.js'
import { COHERENCE_PROMPT, renderPrompt, formatHistory, formatToolCalls, wrapContent } from '../prompts.js'

const schema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string(),
})

export class CoherenceMetric extends QuantitativeMetric {
  readonly name = 'coherence'

  async score(input: ScoreInput): Promise<QuantResult> {
    const prompt = renderPrompt(COHERENCE_PROMPT, {
      goal: wrapContent('goal', input.goal),
      profile: wrapContent('profile', input.profile),
      toolResults: formatToolCalls(input.toolCalls),
      history: formatHistory(input.history),
      userMessage: wrapContent('user-message', input.userMessage),
      agentMessage: wrapContent('agent-message', input.agentMessage),
    })

    const result = await this.llm.generateObject({
      schema,
      messages: [{ role: 'user', content: prompt }],
    })

    return { value: result.object.score, reason: result.object.reason }
  }
}
