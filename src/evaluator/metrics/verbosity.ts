import { z } from 'zod'
import { QuantitativeMetric, type ScoreInput, type QuantResult } from './base.js'
import { VERBOSITY_PROMPT, renderPrompt, wrapContent } from '../prompts.js'

const schema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string(),
})

export class VerbosityMetric extends QuantitativeMetric {
  readonly name = 'verbosity'

  async score(input: ScoreInput): Promise<QuantResult> {
    const prompt = renderPrompt(VERBOSITY_PROMPT, {
      goal: wrapContent('goal', input.goal),
      profile: wrapContent('profile', input.profile),
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
