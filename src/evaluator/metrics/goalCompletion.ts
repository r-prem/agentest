import { z } from 'zod'
import { ConversationMetric, type ConversationScoreInput, type QuantResult } from './base.js'
import { GOAL_COMPLETION_PROMPT, renderPrompt, formatKnowledge, wrapContent } from '../prompts.js'

const schema = z.object({
  score: z.literal(0).or(z.literal(1)),
  reason: z.string(),
})

function formatFullConversation(
  turns: ConversationScoreInput['turns'],
): string {
  return turns
    .map(
      (t, i) =>
        `Turn ${i + 1}:\nUser: ${wrapContent('user-message', t.userMessage)}\nAgent: ${wrapContent('agent-message', t.agentMessage)}`,
    )
    .join('\n\n')
}

export class GoalCompletionMetric extends ConversationMetric {
  readonly name = 'goal_completion'

  async score(input: ConversationScoreInput): Promise<QuantResult> {
    const prompt = renderPrompt(GOAL_COMPLETION_PROMPT, {
      goal: wrapContent('goal', input.goal),
      profile: wrapContent('profile', input.profile),
      knowledge: formatKnowledge(input.knowledge),
      fullConversation: formatFullConversation(input.turns),
    })

    const result = await this.llm.generateObject({
      schema,
      messages: [{ role: 'user', content: prompt }],
    })

    return { value: result.object.score, reason: result.object.reason }
  }
}
