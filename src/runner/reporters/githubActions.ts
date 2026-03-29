import { appendFileSync } from 'node:fs'
import type {
  ScenarioResult,
  RunResult,
  ComparisonScenarioResult,
  ComparisonRunResult,
} from '../runner.js'
import type { Reporter } from './types.js'
import type { UniqueError } from '../../evaluator/errorDetection.js'
import { computeMetricAverages } from '../../evaluator/scoring.js'

/** Escape a string for safe use inside a Markdown table cell. */
function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, '\\`')
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
}

export class GitHubActionsReporter implements Reporter {
  private summaryFile: string | undefined
  private thresholds: Record<string, number>

  constructor(thresholds?: Record<string, number>) {
    this.summaryFile = process.env.GITHUB_STEP_SUMMARY
    this.thresholds = thresholds ?? {}
  }

  onScenarioEnd(result: ScenarioResult): void {
    this.emitAnnotationsForScenario(result)
  }

  onRunEnd(result: RunResult): void {
    this.emitRunAnnotations(result)
    this.writeSummary(this.buildStandardSummary(result))
  }

  onComparisonScenarioEnd(comparison: ComparisonScenarioResult): void {
    for (const { agentName, scenarioResult } of comparison.agentResults) {
      this.emitAnnotationsForScenario(scenarioResult, agentName)
    }
  }

  onComparisonRunEnd(result: ComparisonRunResult): void {
    for (const [agentName, agentResult] of result.perAgent) {
      if (!agentResult.passed) {
        this.annotate(
          'error',
          `Agent "${agentName}" failed`,
          `${agentResult.failedScenarios}/${agentResult.totalScenarios} scenarios failed`,
        )
      }
    }
    this.writeSummary(this.buildComparisonSummary(result))
  }

  // --- Annotations ---

  private emitAnnotationsForScenario(result: ScenarioResult, agentLabel?: string): void {
    const prefix = agentLabel ? `[${agentLabel}] ` : ''

    if (!result.passed) {
      this.annotate(
        'error',
        `${prefix}Scenario failed: ${result.scenario.name}`,
        this.getFailureReason(result),
      )
    }

    for (const error of result.errors) {
      const level = this.severityToLevel(error.severity)
      this.annotate(
        level,
        `${prefix}${error.label}`,
        `${error.explanation} (${error.occurrences.length} occurrence(s))`,
      )
    }
  }

  private emitRunAnnotations(result: RunResult): void {
    for (const sr of result.scenarioResults) {
      const violations = this.computeThresholdViolations(sr)
      for (const v of violations) {
        this.annotate(
          'warning',
          `Threshold violation: ${v.metric}`,
          `Average ${v.avg.toFixed(2)} < threshold ${v.threshold} in "${sr.scenario.name}"`,
        )
      }
    }
  }

  private annotate(level: 'error' | 'warning' | 'notice', title: string, message: string): void {
    const safeTitle = title.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
    const safeMessage = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
    console.log(`::${level} title=${safeTitle}::${safeMessage}`)
  }

  private severityToLevel(severity: string): 'error' | 'warning' | 'notice' {
    if (severity === 'critical' || severity === 'high') return 'error'
    if (severity === 'medium') return 'warning'
    return 'notice'
  }

  // --- Step Summary ---

  private writeSummary(markdown: string): void {
    if (!this.summaryFile) return
    try {
      appendFileSync(this.summaryFile, markdown)
    } catch {
      console.warn('Failed to write to $GITHUB_STEP_SUMMARY')
    }
  }

  private buildStandardSummary(result: RunResult): string {
    const icon = result.passed ? '✅' : '❌'
    const lines: string[] = [
      `## Agentest Results`,
      '',
      `**${result.passedScenarios}/${result.totalScenarios} scenarios passed** ${icon}`,
      '',
    ]

    // Scenario table
    const metricNames = this.collectMetricNames(result.scenarioResults)
    const headers = ['Scenario', 'Status', 'Conversations', ...metricNames]
    lines.push(`| ${headers.join(' | ')} |`)
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`)

    for (const sr of result.scenarioResults) {
      const status = sr.passed ? '✅ Pass' : '❌ Fail'
      const convCount = sr.simulation.conversations.length
      const erroredCount = sr.simulation.conversations.filter((c) => c.error).length
      const convStatus =
        erroredCount > 0 ? `${convCount - erroredCount}/${convCount}` : `${convCount}/${convCount}`

      const avgScores = computeMetricAverages(sr.evaluations.values())
      const scoreCells = metricNames.map((m) => {
        const val = avgScores[m]
        return val != null ? val.toFixed(1) : '—'
      })

      lines.push(
        `| ${escapeMarkdown(sr.scenario.name)} | ${status} | ${convStatus} | ${scoreCells.join(' | ')} |`,
      )
    }

    // Errors
    const allErrors = result.scenarioResults.flatMap((sr) => sr.errors)
    if (allErrors.length > 0) {
      lines.push('', '### Errors', '')
      lines.push('| Severity | Error | Occurrences |')
      lines.push('| --- | --- | --- |')
      for (const err of allErrors) {
        const icon = SEVERITY_ICONS[err.severity] ?? '⚪'
        lines.push(
          `| ${icon} ${err.severity} | ${escapeMarkdown(err.label)} | ${err.occurrences.length} |`,
        )
      }
    }

    // Threshold violations
    const allViolations = result.scenarioResults.flatMap((sr) =>
      this.computeThresholdViolations(sr).map((v) => ({ ...v, scenario: sr.scenario.name })),
    )
    if (allViolations.length > 0) {
      lines.push('', '### Threshold Violations', '')
      lines.push('| Scenario | Metric | Average | Threshold |')
      lines.push('| --- | --- | --- | --- |')
      for (const v of allViolations) {
        lines.push(
          `| ${escapeMarkdown(v.scenario)} | ${escapeMarkdown(v.metric)} | ${v.avg.toFixed(2)} | ${v.threshold} |`,
        )
      }
    }

    lines.push('')
    return lines.join('\n')
  }

  private buildComparisonSummary(result: ComparisonRunResult): string {
    const icon = result.passed ? '✅' : '❌'
    const lines: string[] = [`## Agentest Comparison Results ${icon}`, '']

    // Collect all metric names across all agents
    const metricNames = new Set<string>()
    for (const agentResult of result.perAgent.values()) {
      for (const sr of agentResult.scenarioResults) {
        for (const name of Object.keys(computeMetricAverages(sr.evaluations.values()))) {
          metricNames.add(name)
        }
      }
    }
    const metrics = [...metricNames]

    // Agent summary table
    const headers = ['Agent', 'Scenarios Passed', ...metrics]
    lines.push(`| ${headers.join(' | ')} |`)
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`)

    for (const agentName of result.agents) {
      const agentResult = result.perAgent.get(agentName)!
      const statusIcon = agentResult.passed ? '✅' : '❌'

      // Compute global averages across all scenarios for this agent
      const globalSums: Record<string, number> = {}
      const globalCounts: Record<string, number> = {}
      for (const sr of agentResult.scenarioResults) {
        const avgs = computeMetricAverages(sr.evaluations.values())
        for (const [m, v] of Object.entries(avgs)) {
          globalSums[m] = (globalSums[m] ?? 0) + v
          globalCounts[m] = (globalCounts[m] ?? 0) + 1
        }
      }

      const scoreCells = metrics.map((m) => {
        if (globalCounts[m]) return (globalSums[m] / globalCounts[m]).toFixed(1)
        return '—'
      })

      lines.push(
        `| ${escapeMarkdown(agentName)} | ${agentResult.passedScenarios}/${agentResult.totalScenarios} ${statusIcon} | ${scoreCells.join(' | ')} |`,
      )
    }

    // Per-scenario breakdown
    lines.push('', '### Per-Scenario Breakdown', '')
    for (const sc of result.scenarioComparisons) {
      lines.push(`#### ${escapeMarkdown(sc.scenario.name)}`, '')
      const scHeaders = ['Agent', 'Status', ...metrics]
      lines.push(`| ${scHeaders.join(' | ')} |`)
      lines.push(`| ${scHeaders.map(() => '---').join(' | ')} |`)

      for (const { agentName, scenarioResult } of sc.agentResults) {
        const status = scenarioResult.passed ? '✅' : '❌'
        const avgs = computeMetricAverages(scenarioResult.evaluations.values())
        const cells = metrics.map((m) => (avgs[m] != null ? avgs[m].toFixed(1) : '—'))
        lines.push(`| ${escapeMarkdown(agentName)} | ${status} | ${cells.join(' | ')} |`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // --- Helpers ---

  private collectMetricNames(scenarioResults: ScenarioResult[]): string[] {
    const names = new Set<string>()
    for (const sr of scenarioResults) {
      for (const name of Object.keys(computeMetricAverages(sr.evaluations.values()))) {
        names.add(name)
      }
    }
    return [...names]
  }

  private computeThresholdViolations(
    sr: ScenarioResult,
  ): Array<{ metric: string; avg: number; threshold: number }> {
    const violations: Array<{ metric: string; avg: number; threshold: number }> = []
    const averages = computeMetricAverages(sr.evaluations.values())

    for (const [metric, threshold] of Object.entries(this.thresholds)) {
      const avg = averages[metric]
      if (avg != null && avg < threshold) {
        violations.push({ metric, avg, threshold })
      }
    }

    return violations
  }

  private getFailureReason(result: ScenarioResult): string {
    const reasons: string[] = []

    const erroredConvs = result.simulation.conversations.filter((c) => c.error)
    if (erroredConvs.length > 0) {
      reasons.push(`${erroredConvs.length} conversation(s) errored`)
    }

    const failedTrajectories = [...result.trajectoryResults.values()].filter((t) => !t.matched)
    if (failedTrajectories.length > 0) {
      reasons.push(`${failedTrajectories.length} trajectory assertion(s) failed`)
    }

    if (result.errors.length > 0) {
      const critical = result.errors.filter(
        (e) => e.severity === 'critical' || e.severity === 'high',
      )
      if (critical.length > 0) {
        reasons.push(`${critical.length} critical/high error(s)`)
      }
    }

    const violations = this.computeThresholdViolations(result)
    if (violations.length > 0) {
      reasons.push(`${violations.length} threshold violation(s)`)
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Unknown failure reason'
  }
}
