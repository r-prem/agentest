import type { ConversationEvaluation } from './evaluator.js'

/**
 * Computes average scores across turn evaluations for all numeric metrics.
 * Does NOT include goal_completion — use computeMetricAverages() for that.
 */
export function computeTurnAverages(
  turnEvaluations: Array<{
    metrics: Record<string, { value: string | number; reason: string }>
  }>,
): Record<string, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}

  for (const turn of turnEvaluations) {
    for (const [name, result] of Object.entries(turn.metrics)) {
      if (typeof result.value === 'number') {
        sums[name] = (sums[name] ?? 0) + result.value
        counts[name] = (counts[name] ?? 0) + 1
      }
    }
  }

  const averages: Record<string, number> = {}
  for (const name of Object.keys(sums)) {
    averages[name] = sums[name] / counts[name]
  }
  return averages
}

/**
 * Computes average scores across all conversations in a scenario,
 * including goal_completion from per-conversation evaluations.
 */
export function computeMetricAverages(
  evaluations: Iterable<ConversationEvaluation>,
): Record<string, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}

  for (const evaluation of evaluations) {
    for (const turn of evaluation.turnEvaluations) {
      for (const [name, result] of Object.entries(turn.metrics)) {
        if (typeof result.value === 'number') {
          sums[name] = (sums[name] ?? 0) + result.value
          counts[name] = (counts[name] ?? 0) + 1
        }
      }
    }

    if (evaluation.goalCompletion) {
      sums['goal_completion'] = (sums['goal_completion'] ?? 0) + evaluation.goalCompletion.value
      counts['goal_completion'] = (counts['goal_completion'] ?? 0) + 1
    }
  }

  const averages: Record<string, number> = {}
  for (const name of Object.keys(sums)) {
    averages[name] = sums[name] / counts[name]
  }
  return averages
}
