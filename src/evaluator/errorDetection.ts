import { z } from 'zod'
import type { LLMProvider } from '../llm/provider.js'
import { ERROR_DEDUPLICATION_PROMPT, renderPrompt } from './prompts.js'
import type { QualResult } from './metrics/base.js'

export interface FailureTurn {
  id: string
  scenarioName: string
  conversationId: string
  turnIndex: number
  metricName: string
  label: string
  reason: string
}

export interface UniqueError {
  label: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  occurrences: string[]
  explanation: string
}

const deduplicationSchema = z.object({
  groups: z.array(
    z.object({
      label: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      turnIds: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
})

export class ErrorDetection {
  constructor(private llm: LLMProvider) {}

  async deduplicate(failures: FailureTurn[]): Promise<UniqueError[]> {
    if (failures.length === 0) return []

    const formatted = failures
      .map(
        (f) =>
          `[${f.id}] scenario="${f.scenarioName}" conv=${f.conversationId} turn=${f.turnIndex} metric=${f.metricName} label="${f.label}": ${f.reason}`,
      )
      .join('\n')

    const prompt = renderPrompt(ERROR_DEDUPLICATION_PROMPT, {
      failures: formatted,
    })

    const result = await this.llm.generateObject({
      schema: deduplicationSchema,
      messages: [{ role: 'user', content: prompt }],
    })

    return result.object.groups.map((g) => ({
      label: g.label,
      severity: g.severity,
      occurrences: g.turnIds,
      explanation: g.explanation,
    }))
  }

  collectFailures(
    scenarioName: string,
    conversationId: string,
    turnEvaluations: Array<{
      turnIndex: number
      metrics: Record<string, { value: string | number; reason: string }>
    }>,
  ): FailureTurn[] {
    const failures: FailureTurn[] = []
    let counter = 0

    for (const turn of turnEvaluations) {
      for (const [metricName, result] of Object.entries(turn.metrics)) {
        const isFailure = typeof result.value === 'string' && result.value !== 'no failure'

        if (isFailure) {
          failures.push({
            id: `${conversationId}-F${++counter}`,
            scenarioName,
            conversationId,
            turnIndex: turn.turnIndex,
            metricName,
            label: result.value as string,
            reason: result.reason,
          })
        }
      }
    }

    return failures
  }
}
