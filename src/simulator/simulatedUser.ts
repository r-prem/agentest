import { z } from 'zod'
import type { LLMProvider } from '../llm/provider.js'
import type { ScenarioOptions, KnowledgeItem } from '../scenario/types.js'

export interface SimulatedUserMessage {
  message: string
  shouldStop: boolean
}

const STOP_TOKEN = '[[STOP]]'

export class SimulatedUser {
  private systemPrompt: string

  constructor(
    private llm: LLMProvider,
    scenario: ScenarioOptions,
  ) {
    this.systemPrompt = buildSystemPrompt(scenario)
  }

  async generateMessage(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<SimulatedUserMessage> {
    const result = await this.llm.generateObject({
      schema: simulatedUserResponseSchema,
      system: this.systemPrompt,
      messages:
        conversationHistory.length === 0
          ? [
              {
                role: 'user' as const,
                content: 'Begin the conversation. Send your first message to the agent.',
              },
            ]
          : conversationHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
    })

    const shouldStop = result.object.shouldStop || result.object.message.includes(STOP_TOKEN)
    const message = result.object.message.replace(STOP_TOKEN, '').trim()

    return { message, shouldStop }
  }
}

const simulatedUserResponseSchema = z.object({
  message: z.string().describe('The next message to send to the agent'),
  shouldStop: z
    .boolean()
    .describe('Whether the conversation goal has been achieved and the conversation should end'),
})

function buildSystemPrompt(scenario: ScenarioOptions): string {
  if (scenario.userPromptTemplate) {
    return renderTemplate(scenario.userPromptTemplate, scenario)
  }

  return buildDefaultSystemPrompt(scenario)
}

function renderTemplate(template: string, scenario: ScenarioOptions): string {
  const knowledgeStr =
    scenario.knowledge && scenario.knowledge.length > 0
      ? scenario.knowledge.map((k: KnowledgeItem) => `- ${k.content}`).join('\n')
      : ''

  return template
    .replaceAll('{{profile}}', scenario.profile)
    .replaceAll('{{goal}}', scenario.goal)
    .replaceAll('{{knowledge}}', knowledgeStr)
}

function buildDefaultSystemPrompt(scenario: ScenarioOptions): string {
  const parts: string[] = [
    'You are a simulated user interacting with an AI agent. Your job is to play the role described below and work toward the stated goal.',
    '',
    `## Your Profile`,
    scenario.profile,
    '',
    `## Your Goal`,
    scenario.goal,
    '',
    '## Instructions',
    '- Stay in character according to your profile.',
    '- Work toward your goal naturally through conversation.',
    '- When your goal has been fully achieved, set shouldStop to true.',
    '- If you believe the goal cannot be achieved (agent refuses, hits a dead end), set shouldStop to true.',
    '- Do NOT reveal that you are a simulated user.',
    '- Keep messages concise and realistic.',
  ]

  if (scenario.knowledge && scenario.knowledge.length > 0) {
    parts.push(
      '',
      '## Your Knowledge',
      'You know the following facts (use them naturally if relevant):',
      ...scenario.knowledge.map((k: KnowledgeItem) => `- ${k.content}`),
    )
  }

  return parts.join('\n')
}
