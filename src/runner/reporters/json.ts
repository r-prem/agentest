import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  RunResult,
  ScenarioResult,
  ComparisonScenarioResult,
  ComparisonRunResult,
} from '../runner.js'
import type { Reporter } from './types.js'

export interface JsonReporterOptions {
  outputDir?: string
  filename?: string
}

export class JsonReporter implements Reporter {
  private outputDir: string
  private filename: string

  constructor(options: JsonReporterOptions = {}) {
    this.outputDir = options.outputDir ?? '.agentest'
    this.filename = options.filename ?? 'results.json'
  }

  async onRunEnd(result: RunResult): Promise<void> {
    const output = this.serialize(result)
    await this.writeOutput(output)
  }

  async onComparisonRunEnd(result: ComparisonRunResult): Promise<void> {
    const output = this.serializeComparison(result)
    await this.writeOutput(output)
  }

  private async writeOutput(output: object): Promise<void> {
    const resolvedDir = path.resolve(this.outputDir)
    const cwd = process.cwd()
    if (resolvedDir !== cwd && !resolvedDir.startsWith(cwd + path.sep)) {
      throw new Error(
        `JSON reporter output directory "${this.outputDir}" resolves outside the working directory`,
      )
    }
    await mkdir(resolvedDir, { recursive: true })
    const filePath = path.resolve(resolvedDir, this.filename)
    if (!filePath.startsWith(resolvedDir + path.sep)) {
      throw new Error(
        `JSON reporter filename "${this.filename}" resolves outside the output directory`,
      )
    }
    await writeFile(filePath, JSON.stringify(output, null, 2))
    console.log(`Results written to ${filePath}`)
  }

  private serialize(result: RunResult): object {
    return {
      summary: {
        passed: result.passed,
        totalScenarios: result.totalScenarios,
        passedScenarios: result.passedScenarios,
        failedScenarios: result.failedScenarios,
      },
      scenarios: result.scenarioResults.map((sr) => this.serializeScenario(sr)),
    }
  }

  private serializeComparison(result: ComparisonRunResult): object {
    const perAgent: Record<string, object> = {}
    for (const [agentName, agentResult] of result.perAgent) {
      perAgent[agentName] = {
        passed: agentResult.passed,
        passedScenarios: agentResult.passedScenarios,
        failedScenarios: agentResult.failedScenarios,
      }
    }

    return {
      mode: 'comparison',
      agents: result.agents,
      summary: {
        passed: result.passed,
        perAgent,
      },
      scenarios: result.scenarioComparisons.map((sc) => ({
        name: sc.scenario.name,
        agents: sc.agentResults.map((ar) => ({
          agent: ar.agentName,
          ...this.serializeScenario(ar.scenarioResult),
        })),
      })),
    }
  }

  private serializeScenario(sr: ScenarioResult): object {
    return {
      name: sr.scenario.name,
      passed: sr.passed,
      conversations: sr.simulation.conversations.map((conv) => {
        const evaluation = sr.evaluations.get(conv.conversationId)
        const trajectory = sr.trajectoryResults.get(conv.conversationId)

        return {
          conversationId: conv.conversationId,
          error: conv.error ?? null,
          turns: conv.turns.map((t) => ({
            turnIndex: t.turnIndex,
            userMessage: t.userMessage,
            agentMessage: t.agentMessage,
            toolCalls: t.toolCalls,
          })),
          evaluation: evaluation
            ? {
                turnEvaluations: evaluation.turnEvaluations.map((te) => ({
                  turnIndex: te.turnIndex,
                  metrics: te.metrics,
                })),
                goalCompletion: evaluation.goalCompletion,
              }
            : null,
          trajectory: trajectory ?? null,
          perTurnTrajectory:
            sr.perTurnTrajectoryResults.get(conv.conversationId)?.map((r) => ({
              turnIndex: r.turnIndex,
              ...r.result,
            })) ?? null,
        }
      }),
      errors: sr.errors,
    }
  }
}
