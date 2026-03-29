import type { Scenario } from '../../scenario/types.js'
import type { ScenarioResult, RunResult, ComparisonScenarioResult, ComparisonRunResult } from '../runner.js'
import type { Reporter, ProgressEvent } from './types.js'
import type { TurnRecord } from '../../simulator/simulator.js'
import type { ConversationEvaluation } from '../../evaluator/evaluator.js'
import { computeTurnAverages, computeMetricAverages } from '../../evaluator/scoring.js'

const PASS = '\x1b[32m\u2713\x1b[0m'
const FAIL = '\x1b[31m\u2717\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class ConsoleReporter implements Reporter {
  private spinnerInterval: ReturnType<typeof setInterval> | null = null
  private spinnerFrame = 0
  private currentStatus = ''
  private isTTY = process.stderr.isTTY ?? false
  private thresholds: Record<string, number>
  private verbose: boolean

  constructor(thresholds?: Record<string, number>, verbose?: boolean) {
    this.thresholds = thresholds ?? {}
    this.verbose = verbose ?? false
  }

  onRunStart(scenarios: Scenario[], agents?: string[]): void {
    console.log()
    if (agents && agents.length > 1) {
      console.log(`${BOLD}Agentest${RESET} ${DIM}comparing ${agents.length} agents across ${scenarios.length} scenario(s)${RESET}`)
      console.log(`${DIM}Agents: ${agents.join(', ')}${RESET}`)
    } else {
      console.log(`${BOLD}Agentest${RESET} ${DIM}running ${scenarios.length} scenario(s)${RESET}`)
    }
    console.log()
  }

  onProgress(event: ProgressEvent): void {
    const phaseLabels: Record<ProgressEvent['phase'], string> = {
      simulating: 'simulating',
      evaluating: 'evaluating',
      trajectories: 'checking trajectories',
      deduplicating: 'deduplicating errors',
    }

    const label = phaseLabels[event.phase]
    const detail = event.detail ? ` ${DIM}${event.detail}${RESET}` : ''
    this.currentStatus = `${CYAN}${event.scenario}${RESET} → ${label}${detail}`

    if (this.isTTY) {
      this.startSpinner()
    } else {
      // Non-TTY: print one line per phase change
      console.log(`  ${DIM}▸${RESET} ${this.currentStatus}`)
    }
  }

  onScenarioEnd(result: ScenarioResult): void {
    this.stopSpinner()

    const icon = result.passed ? PASS : FAIL
    const name = result.scenario.name

    console.log(`${icon} ${name}`)
    this.printScenarioDetails(result)
    console.log(`${DIM}${'─'.repeat(40)}${RESET}`)
    console.log()
  }

  onRunEnd(result: RunResult): void {
    this.stopSpinner()
    const color = result.passed ? GREEN : RED
    console.log(
      `${BOLD}${color}${result.passedScenarios}/${result.totalScenarios} scenarios passed${RESET}`,
    )
    console.log()
  }

  onComparisonScenarioEnd(comparison: ComparisonScenarioResult): void {
    this.stopSpinner()

    console.log(`${BOLD}${comparison.scenario.name}${RESET}`)

    for (const { agentName, scenarioResult } of comparison.agentResults) {
      const icon = scenarioResult.passed ? PASS : FAIL
      console.log(`  ${icon} ${CYAN}${agentName}${RESET}`)
      this.printScenarioDetails(scenarioResult, '    ')
    }

    // Print metric comparison table
    this.printMetricComparison(comparison)
    console.log(`${DIM}${'─'.repeat(40)}${RESET}`)
    console.log()
  }

  onComparisonRunEnd(result: ComparisonRunResult): void {
    this.stopSpinner()

    console.log(`${BOLD}Comparison Summary${RESET}`)
    console.log()

    for (const agentName of result.agents) {
      const agentResult = result.perAgent.get(agentName)!
      const color = agentResult.passed ? GREEN : RED
      console.log(
        `  ${color}${agentName}${RESET}: ${agentResult.passedScenarios}/${agentResult.totalScenarios} scenarios passed`,
      )
    }

    console.log()
    const overallColor = result.passed ? GREEN : RED
    console.log(`${BOLD}${overallColor}Overall: ${result.passed ? 'PASS' : 'FAIL'}${RESET}`)
    console.log()
  }

  private printScenarioDetails(result: ScenarioResult, indent = '  '): void {
    // Conversation summaries
    for (const conv of result.simulation.conversations) {
      const turnCount = conv.turns.length
      const prefix = conv.error ? `${indent}${FAIL}` : `${indent}${PASS}`

      if (conv.error) {
        console.log(`${prefix} ${conv.conversationId} ${RED}(error: ${conv.error})${RESET}`)
        continue
      }

      const evaluation = result.evaluations.get(conv.conversationId)
      const trajectory = result.trajectoryResults.get(conv.conversationId)

      const parts: string[] = [`${turnCount} turns`]

      // Goal completion
      if (evaluation?.goalCompletion) {
        parts.push(
          evaluation.goalCompletion.value === 1
            ? `${GREEN}goal met${RESET}`
            : `${RED}goal not met${RESET}`,
        )
      }

      // Trajectory
      if (trajectory) {
        if (trajectory.matched) {
          parts.push(`${GREEN}trajectory matched${RESET}`)
        } else {
          const details: string[] = ['trajectory failed']
          if (trajectory.forbiddenCalls.length > 0) {
            details.push(`forbidden: ${trajectory.forbiddenCalls.join(', ')}`)
          }
          if (trajectory.missingCalls.length > 0) {
            details.push(`missing: ${trajectory.missingCalls.join(', ')}`)
          }
          parts.push(`${RED}${details.join(' — ')}${RESET}`)
        }
      }

      // Average scores
      if (evaluation) {
        const avgScores = computeTurnAverages(evaluation.turnEvaluations)
        for (const [metric, avg] of Object.entries(avgScores)) {
          const threshold = this.thresholds[metric]
          const color = threshold != null && avg < threshold
            ? RED
            : avg >= 4 ? GREEN : avg >= 3 ? YELLOW : RED
          parts.push(`${metric}: ${color}${avg.toFixed(1)}${RESET}`)
        }
      }

      console.log(`${prefix} ${conv.conversationId} ${DIM}(${parts.join(', ')})${RESET}`)

      if (this.verbose) {
        this.printTranscript(conv.turns)
      }
    }

    // Unique errors
    if (result.errors.length > 0) {
      console.log(`${indent}${DIM}Unique errors:${RESET}`)
      for (const err of result.errors) {
        const sevColor =
          err.severity === 'critical'
            ? RED
            : err.severity === 'high'
              ? RED
              : err.severity === 'medium'
                ? YELLOW
                : DIM
        console.log(
          `${indent}  ${sevColor}[${err.severity}]${RESET} ${err.label} ${DIM}(${err.occurrences.length} occurrence(s))${RESET}`,
        )
        console.log(`${indent}    ${DIM}${err.explanation}${RESET}`)
      }
    }

    // Threshold failures
    if (!result.passed && Object.keys(this.thresholds).length > 0) {
      const failures = this.computeThresholdFailures(result)
      if (failures.length > 0) {
        console.log(`${indent}${RED}Threshold failures:${RESET}`)
        for (const f of failures) {
          console.log(`${indent}  ${RED}${f.metric}${RESET}: avg ${RED}${f.avg.toFixed(1)}${RESET} < threshold ${f.threshold}`)
        }
      }
    }
  }

  private printMetricComparison(comparison: ComparisonScenarioResult): void {
    // Collect average scores per agent
    const agentScores = new Map<string, Record<string, number>>()

    for (const { agentName, scenarioResult } of comparison.agentResults) {
      agentScores.set(agentName, computeMetricAverages(scenarioResult.evaluations.values()))
    }

    // Get all metric names
    const metricNames = new Set<string>()
    for (const scores of agentScores.values()) {
      for (const name of Object.keys(scores)) {
        metricNames.add(name)
      }
    }

    if (metricNames.size === 0) return

    console.log(`  ${DIM}── comparison ──${RESET}`)
    const agentNames = comparison.agentResults.map((r) => r.agentName)

    for (const metric of metricNames) {
      const scores = agentNames.map((name) => agentScores.get(name)?.[metric])
      const best = Math.max(...scores.filter((s): s is number => s != null))

      const formatted = agentNames.map((name, i) => {
        const score = scores[i]
        if (score == null) return `${DIM}—${RESET}`
        const color = score === best ? GREEN : score >= best - 0.5 ? YELLOW : RED
        return `${name}: ${color}${score.toFixed(1)}${RESET}`
      })

      console.log(`  ${DIM}${metric}:${RESET} ${formatted.join(`${DIM} | ${RESET}`)}`)
    }
    console.log(`  ${DIM}── end comparison ──${RESET}`)
  }

  private startSpinner(): void {
    if (this.spinnerInterval) return
    this.renderSpinner()
    this.spinnerInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length
      this.renderSpinner()
    }, 80)
  }

  private renderSpinner(): void {
    const frame = `${CYAN}${SPINNER_FRAMES[this.spinnerFrame]}${RESET}`
    process.stderr.write(`\r\x1b[K  ${frame} ${this.currentStatus}`)
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval)
      this.spinnerInterval = null
      process.stderr.write('\r\x1b[K')
    }
  }

  private printTranscript(turns: TurnRecord[]): void {
    console.log(`    ${DIM}── transcript ──${RESET}`)
    for (const turn of turns) {
      console.log(`    ${BOLD}[User]${RESET}  ${turn.userMessage}`)

      for (const tc of turn.toolCalls) {
        console.log(`    ${YELLOW}[Tool]${RESET}  ${tc.name}(${JSON.stringify(tc.args)})`)
        console.log(`           ${DIM}→ ${JSON.stringify(tc.result)}${RESET}`)
      }

      console.log(`    ${CYAN}[Agent]${RESET} ${turn.agentMessage}`)
      console.log()
    }
    console.log(`    ${DIM}── end transcript ──${RESET}`)
  }

  private computeThresholdFailures(
    result: ScenarioResult,
  ): Array<{ metric: string; avg: number; threshold: number }> {
    const averages = computeMetricAverages(result.evaluations.values())
    const failures: Array<{ metric: string; avg: number; threshold: number }> = []

    for (const [metricName, threshold] of Object.entries(this.thresholds)) {
      const avg = averages[metricName]
      if (avg != null && avg < threshold) {
        failures.push({ metric: metricName, avg, threshold })
      }
    }

    return failures
  }
}
