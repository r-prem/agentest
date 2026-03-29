import type { Scenario } from '../../scenario/types.js'
import type {
  ScenarioResult,
  RunResult,
  ComparisonScenarioResult,
  ComparisonRunResult,
} from '../runner.js'

export interface ProgressEvent {
  scenario: string
  conversationId?: string
  phase: 'simulating' | 'evaluating' | 'trajectories' | 'deduplicating'
  detail?: string
}

export interface Reporter {
  onRunStart?(scenarios: Scenario[], agents?: string[]): void | Promise<void>
  onScenarioStart?(scenario: Scenario): void | Promise<void>
  onScenarioEnd?(result: ScenarioResult): void | Promise<void>
  onRunEnd?(result: RunResult): void | Promise<void>
  onProgress?(event: ProgressEvent): void

  // Comparison mode
  onComparisonScenarioEnd?(result: ComparisonScenarioResult): void | Promise<void>
  onComparisonRunEnd?(result: ComparisonRunResult): void | Promise<void>
}
