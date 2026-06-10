import type { Scenario } from '../scenario/types.js'
import type { ScenarioResult } from './runner.js'

/**
 * Re-run failed scenarios up to `retries` times, serially. Runs AFTER the
 * parallel pass so resource contention (a local LLM serving `concurrency`
 * scenarios at once) has subsided — the typical flaky-failure profile.
 *
 * A scenario that passes on retry replaces its failed result and carries
 * `retried: <attempt>`; a scenario that keeps failing keeps its LAST result
 * (freshest trajectory for debugging). Returns the input array untouched when
 * `retries` is 0.
 */
export async function retryFailedScenarios(
  results: ScenarioResult[],
  retries: number,
  rerun: (scenario: Scenario, attempt: number) => Promise<ScenarioResult>,
): Promise<ScenarioResult[]> {
  if (retries <= 0) return results

  const out = [...results]
  for (let attempt = 1; attempt <= retries; attempt++) {
    const failedIndices = out.map((r, i) => (r.passed ? -1 : i)).filter((i) => i >= 0)
    if (failedIndices.length === 0) break

    for (const i of failedIndices) {
      const retried = await rerun(out[i].scenario, attempt)
      out[i] = retried.passed ? { ...retried, retried: attempt } : retried
    }
  }
  return out
}
