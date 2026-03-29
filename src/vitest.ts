import { describe, it, expect, beforeAll } from 'vitest'
import type { AgentestConfig, AgentestConfigInput } from './config/schema.js'
import { defineConfig } from './config/defineConfig.js'
import { discoverAndLoad } from './runner/discovery.js'
import { Runner } from './runner/runner.js'
import type { ScenarioResult } from './runner/runner.js'
import type { DiscoveryResult } from './runner/discovery.js'
import { computeMetricAverages } from './evaluator/scoring.js'

export interface SimSuiteOptions {
  /** Filter scenarios by name (case-insensitive substring match) */
  scenario?: string
  /** Timeout per scenario in milliseconds (default: 120000) */
  timeout?: number
  /** Working directory for scenario discovery (default: process.cwd()) */
  cwd?: string
}

const DEFAULT_TIMEOUT = 120_000

/**
 * Define an Agentest test suite inside a vitest test file.
 *
 * Each scenario becomes an individual `it()` test case.
 *
 * ```ts
 * import { defineSimSuite } from 'agentest/vitest'
 *
 * defineSimSuite({
 *   agent: { name: 'my-agent', endpoint: 'http://localhost:3000/api/chat' },
 * })
 * ```
 */
export function defineSimSuite(
  configInput: AgentestConfig | AgentestConfigInput,
  options: SimSuiteOptions = {},
) {
  const config = defineConfig(configInput as AgentestConfigInput)

  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const cwd = options.cwd ?? process.cwd()

  describe('Agentest', () => {
    let runner: Runner
    let allScenarios: DiscoveryResult[]

    beforeAll(async () => {
      const discoveries = await discoverAndLoad(config, cwd)

      // Filter by scenario name if specified
      if (options.scenario) {
        for (const d of discoveries) {
          d.scenarios = d.scenarios.filter((s) =>
            s.name.toLowerCase().includes(options.scenario!.toLowerCase()),
          )
        }
      }

      allScenarios = discoveries.filter((d) => d.scenarios.length > 0)

      // Create runner with no reporters (vitest handles output)
      runner = new Runner(config, [])
    }, timeout)

    // We need to register tests synchronously, but scenarios are loaded async.
    // Use a deferred pattern: register a single test that runs all scenarios,
    // or use vitest's concurrent test generation.
    //
    // Since vitest needs tests registered synchronously at describe time,
    // we use a wrapper that discovers scenarios first, then creates the suite.
    // This is handled by the alternative `defineSimSuite` approach below.

    it(
      'runs all scenarios',
      async () => {
        if (!allScenarios || allScenarios.length === 0) {
          throw new Error('No scenarios found. Check your include/exclude patterns.')
        }

        const result = await runner.run(allScenarios)

        if (!result.passed) {
          const failureDetails = result.scenarioResults
            .filter((sr) => !sr.passed)
            .map((sr) => formatScenarioFailure(sr))
            .join('\n\n')

          expect.fail(
            `${result.failedScenarios}/${result.totalScenarios} scenarios failed\n\n${failureDetails}`,
          )
        }
      },
      timeout,
    )
  })
}

/**
 * Run a single scenario as a vitest test. Gives more granular control
 * than `defineSimSuite` — import your scenario file directly and test it.
 *
 * ```ts
 * import { runScenario } from 'agentest/vitest'
 * import config from '../agentest.config.js'
 * import '../scenarios/booking.sim.js'
 *
 * it('booking flow', async () => {
 *   const result = await runScenario(config, 'user books a morning slot')
 *   expect(result.passed).toBe(true)
 * })
 * ```
 */
export async function runScenario(
  configInput: AgentestConfig | AgentestConfigInput,
  scenarioName: string,
  options: { cwd?: string } = {},
): Promise<ScenarioResult> {
  const config = defineConfig(configInput as AgentestConfigInput)

  const cwd = options.cwd ?? process.cwd()
  const discoveries = await discoverAndLoad(config, cwd)

  // Find the matching scenario
  const allScenarios = discoveries.flatMap((d) => d.scenarios)
  const match = allScenarios.find((s) => s.name.toLowerCase() === scenarioName.toLowerCase())

  if (!match) {
    const available = allScenarios.map((s) => s.name).join(', ')
    throw new Error(`Scenario "${scenarioName}" not found. Available: ${available}`)
  }

  // Run with a single-scenario discovery
  const runner = new Runner(config, [])
  const result = await runner.run([{ file: 'vitest', scenarios: [match] }])

  return result.scenarioResults[0]
}

function formatScenarioFailure(sr: ScenarioResult): string {
  const lines: string[] = [`--- ${sr.scenario.name} ---`]

  // Errored conversations
  const errored = sr.simulation.conversations.filter((c) => c.error)
  for (const conv of errored) {
    lines.push(`  ${conv.conversationId}: error — ${conv.error}`)
  }

  // Trajectory failures
  for (const [convId, traj] of sr.trajectoryResults) {
    if (!traj.matched) {
      const details: string[] = []
      if (traj.missingCalls.length > 0) details.push(`missing: ${traj.missingCalls.join(', ')}`)
      if (traj.extraCalls.length > 0) details.push(`extra: ${traj.extraCalls.join(', ')}`)
      if (traj.forbiddenCalls.length > 0)
        details.push(`forbidden: ${traj.forbiddenCalls.join(', ')}`)
      lines.push(`  ${convId}: trajectory failed — ${details.join('; ')}`)
    }
  }

  // Metric averages
  const averages = computeMetricAverages(sr.evaluations.values())
  if (Object.keys(averages).length > 0) {
    const scores = Object.entries(averages)
      .map(([name, avg]) => `${name}: ${avg.toFixed(1)}`)
      .join(', ')
    lines.push(`  Metrics: ${scores}`)
  }

  // Errors
  for (const err of sr.errors) {
    lines.push(`  [${err.severity}] ${err.label} (${err.occurrences.length}x)`)
  }

  return lines.join('\n')
}
