import { describe, it, expect, vi } from 'vitest'
import { retryFailedScenarios } from './retry.js'
import type { ScenarioResult } from './runner.js'
import type { Scenario } from '../scenario/types.js'

function scenario(name: string): Scenario {
  return { name, options: { turns: [{ userMessage: 'hi' }] } }
}

function result(scenarioName: string, passed: boolean): ScenarioResult {
  return {
    scenario: scenario(scenarioName),
    simulation: { conversations: [] },
    evaluations: new Map(),
    trajectoryResults: new Map(),
    perTurnTrajectoryResults: new Map(),
    errors: [],
    passed,
  } as unknown as ScenarioResult
}

describe('retryFailedScenarios', () => {
  it('re-runs only the failed scenarios and replaces results that pass on retry', async () => {
    const results = [result('a', true), result('b', false), result('c', false)]
    const rerun = vi.fn(async (s: Scenario) => result(s.name, s.name === 'b'))

    const out = await retryFailedScenarios(results, 1, rerun)

    expect(rerun).toHaveBeenCalledTimes(2)
    expect(out[0].passed).toBe(true) // untouched
    expect(out[1].passed).toBe(true) // recovered on retry
    expect(out[1].retried).toBe(1)
    expect(out[2].passed).toBe(false) // still failing — keeps the retry result
  })

  it('stops retrying a scenario once it passes', async () => {
    const results = [result('a', false)]
    const rerun = vi.fn(async (s: Scenario) => result(s.name, true))

    await retryFailedScenarios(results, 3, rerun)

    expect(rerun).toHaveBeenCalledTimes(1)
  })

  it('retries up to the configured number of attempts', async () => {
    const results = [result('a', false)]
    const rerun = vi.fn(async (s: Scenario) => result(s.name, false))

    await retryFailedScenarios(results, 2, rerun)

    expect(rerun).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when retries is 0', async () => {
    const results = [result('a', false)]
    const rerun = vi.fn()

    const out = await retryFailedScenarios(results, 0, rerun)

    expect(rerun).not.toHaveBeenCalled()
    expect(out).toBe(results)
  })
})
