import pLimit from 'p-limit'
import type { AgentestConfig } from '../config/schema.js'
import type { Scenario } from '../scenario/types.js'
import {
  Simulator,
  type SimulationResult,
  type ConversationRecord,
  type SimulatorProgressCallback,
} from '../simulator/simulator.js'
import { Evaluator, type ConversationEvaluation, type MetricName } from '../evaluator/evaluator.js'
import { TrajectoryMatcher, type TrajectoryResult } from '../evaluator/trajectory.js'
import { ErrorDetection, type UniqueError, type FailureTurn } from '../evaluator/errorDetection.js'
import { createProvider } from '../llm/provider.js'
import type { LLMProvider } from '../llm/provider.js'
import { computeThresholdViolations } from '../evaluator/scoring.js'
import type { DiscoveryResult } from './discovery.js'
import type { Reporter, ProgressEvent } from './reporters/types.js'

export interface PerTurnTrajectoryResult {
  turnIndex: number
  result: TrajectoryResult
}

export interface ScenarioResult {
  scenario: Scenario
  simulation: SimulationResult
  evaluations: Map<string, ConversationEvaluation>
  trajectoryResults: Map<string, TrajectoryResult>
  perTurnTrajectoryResults: Map<string, PerTurnTrajectoryResult[]>
  errors: UniqueError[]
  passed: boolean
}

export interface RunResult {
  scenarioResults: ScenarioResult[]
  passed: boolean
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
}

export interface ComparisonAgentResult {
  agentName: string
  scenarioResult: ScenarioResult
}

export interface ComparisonScenarioResult {
  scenario: Scenario
  agentResults: ComparisonAgentResult[]
}

export interface ComparisonRunResult {
  agents: string[]
  scenarioComparisons: ComparisonScenarioResult[]
  perAgent: Map<string, RunResult>
  passed: boolean
}

export class Runner {
  private config: AgentestConfig
  private reporters: Reporter[]
  private limit: ReturnType<typeof pLimit>

  constructor(config: AgentestConfig, reporters: Reporter[]) {
    this.config = config
    this.reporters = reporters
    this.limit = pLimit(config.concurrency)
  }

  private async createInfrastructure() {
    const llm = await createProvider(
      this.config.provider,
      this.config.model,
      this.config.providerOptions,
    )
    const evaluator = new Evaluator(
      llm,
      this.config.metrics,
      this.config.customMetrics,
      this.config.concurrency,
    )
    const trajectoryMatcher = new TrajectoryMatcher()
    const errorDetection = new ErrorDetection(llm)
    return { llm, evaluator, trajectoryMatcher, errorDetection }
  }

  async run(discoveries: DiscoveryResult[]): Promise<RunResult> {
    const { llm, evaluator, trajectoryMatcher, errorDetection } = await this.createInfrastructure()
    const simulator = new Simulator(this.config, llm)
    simulator.onProgress = (event) => {
      this.emitProgress({
        scenario: event.scenario,
        conversationId: event.conversationId,
        phase: 'simulating',
        detail: `${event.conversationId} turn ${event.turn}/${event.maxTurns} — ${Runner.formatPhaseLabel(event.phase)}`,
      })
    }

    const allScenarios = discoveries.flatMap((d) => d.scenarios)

    for (const reporter of this.reporters) {
      await reporter.onRunStart?.(allScenarios)
    }

    // Run all scenarios in parallel (bounded by concurrency)
    const scenarioResults = await Promise.all(
      allScenarios.map((scenario) =>
        this.limit(() =>
          this.runScenario(scenario, simulator, evaluator, trajectoryMatcher, errorDetection),
        ),
      ),
    )

    const passedScenarios = scenarioResults.filter((r) => r.passed).length
    const result: RunResult = {
      scenarioResults,
      passed: passedScenarios === scenarioResults.length,
      totalScenarios: scenarioResults.length,
      passedScenarios,
      failedScenarios: scenarioResults.length - passedScenarios,
    }

    for (const reporter of this.reporters) {
      await reporter.onRunEnd?.(result)
    }

    return result
  }

  async runComparison(discoveries: DiscoveryResult[]): Promise<ComparisonRunResult> {
    const primaryAgent = this.config.agent
    const compareOverrides = this.config.compare ?? []

    // Build resolved agent configs: primary + each override merged onto primary
    const resolvedAgents: Array<{ name: string; config: AgentestConfig }> = [
      { name: primaryAgent.name, config: this.config },
    ]

    for (const entry of compareOverrides) {
      // Standalone custom handler — use as-is
      if ('type' in entry && entry.type === 'custom') {
        resolvedAgents.push({
          name: entry.name,
          config: { ...this.config, agent: entry as AgentestConfig['agent'] },
        })
        continue
      }

      // Override — merge onto primary agent
      if (primaryAgent.type === 'custom') {
        throw new Error(
          `Compare entry "${entry.name}" is an override but the primary agent uses a custom handler. ` +
            `Use type: 'custom' with a handler for this compare entry instead.`,
        )
      }

      const override = entry as {
        name: string
        endpoint?: string
        headers?: Record<string, string>
        body?: Record<string, unknown>
        streaming?: boolean
      }
      const mergedAgent = {
        ...primaryAgent,
        name: override.name,
        endpoint: override.endpoint ?? primaryAgent.endpoint,
        headers: override.headers ?? primaryAgent.headers,
        body: override.body
          ? { ...(primaryAgent.body ?? {}), ...override.body }
          : primaryAgent.body,
        streaming: override.streaming ?? primaryAgent.streaming,
      }
      resolvedAgents.push({
        name: override.name,
        config: { ...this.config, agent: mergedAgent },
      })
    }

    const agentNames = resolvedAgents.map((a) => a.name)

    const { llm, evaluator, trajectoryMatcher, errorDetection } = await this.createInfrastructure()

    // Create a simulator per agent
    const simulators = new Map<string, Simulator>()
    for (const { name, config } of resolvedAgents) {
      const simulator = new Simulator(config, llm)
      simulator.onProgress = (event) => {
        this.emitProgress({
          scenario: event.scenario,
          conversationId: event.conversationId,
          phase: 'simulating',
          detail: `[${name}] ${event.conversationId} turn ${event.turn}/${event.maxTurns} — ${Runner.formatPhaseLabel(event.phase)}`,
        })
      }
      simulators.set(name, simulator)
    }

    const allScenarios = discoveries.flatMap((d) => d.scenarios)

    for (const reporter of this.reporters) {
      await reporter.onRunStart?.(allScenarios, agentNames)
    }

    // For each scenario, run against all agents
    const scenarioComparisons: ComparisonScenarioResult[] = []
    const perAgentResults = new Map<string, ScenarioResult[]>()
    for (const name of agentNames) {
      perAgentResults.set(name, [])
    }

    for (const scenario of allScenarios) {
      // Run all agents in parallel for this scenario
      const agentResults = await Promise.all(
        agentNames.map((agentName) =>
          this.limit(async () => {
            const simulator = simulators.get(agentName)!
            const result = await this.runScenario(
              scenario,
              simulator,
              evaluator,
              trajectoryMatcher,
              errorDetection,
              agentName,
            )
            return { agentName, scenarioResult: result } as ComparisonAgentResult
          }),
        ),
      )

      for (const ar of agentResults) {
        perAgentResults.get(ar.agentName)!.push(ar.scenarioResult)
      }

      const comparison: ComparisonScenarioResult = { scenario, agentResults }
      scenarioComparisons.push(comparison)

      for (const reporter of this.reporters) {
        await reporter.onComparisonScenarioEnd?.(comparison)
      }
    }

    // Build per-agent RunResults
    const perAgent = new Map<string, RunResult>()
    for (const [agentName, results] of perAgentResults) {
      const passed = results.filter((r) => r.passed).length
      perAgent.set(agentName, {
        scenarioResults: results,
        passed: passed === results.length,
        totalScenarios: results.length,
        passedScenarios: passed,
        failedScenarios: results.length - passed,
      })
    }

    const allPassed = [...perAgent.values()].every((r) => r.passed)
    const comparisonResult: ComparisonRunResult = {
      agents: agentNames,
      scenarioComparisons,
      perAgent,
      passed: allPassed,
    }

    for (const reporter of this.reporters) {
      await reporter.onComparisonRunEnd?.(comparisonResult)
    }

    return comparisonResult
  }

  private async runScenario(
    scenario: Scenario,
    simulator: Simulator,
    evaluator: Evaluator,
    trajectoryMatcher: TrajectoryMatcher,
    errorDetection: ErrorDetection,
    agentLabel?: string,
  ): Promise<ScenarioResult> {
    // Only emit onScenarioStart in non-comparison mode (comparison has its own events)
    if (!agentLabel) {
      for (const reporter of this.reporters) {
        await reporter.onScenarioStart?.(scenario)
      }
    }

    const label = agentLabel ? `[${agentLabel}] ` : ''

    // 1. Simulate conversations
    const isScripted = Array.isArray(scenario.options.turns) && scenario.options.turns.length > 0
    const conversationCount =
      scenario.options.conversationsPerScenario ??
      (isScripted ? 1 : this.config.conversationsPerScenario)
    this.emitProgress({
      scenario: scenario.name,
      phase: 'simulating',
      detail: `${label}${conversationCount} conversation(s)`,
    })
    const simulation = await simulator.runScenario(scenario)

    // 2. Evaluate each conversation (skip for scripted scenarios without a goal)
    const evaluations = new Map<string, ConversationEvaluation>()
    for (const conv of simulation.conversations) {
      if (conv.error) continue // skip errored conversations
      if (isScripted && !scenario.options.goal) continue // no meaningful goal to evaluate against

      this.emitProgress({
        scenario: scenario.name,
        conversationId: conv.conversationId,
        phase: 'evaluating',
        detail: `${label}${conv.conversationId}`,
      })
      const evaluation = await evaluator.evaluateConversation(conv.turns, scenario.options)
      evaluations.set(conv.conversationId, evaluation)
    }

    // 3. Run trajectory assertions
    this.emitProgress({
      scenario: scenario.name,
      phase: 'trajectories',
    })
    const trajectoryResults = new Map<string, TrajectoryResult>()
    if (scenario.options.assertions?.toolCalls) {
      for (const conv of simulation.conversations) {
        if (conv.error) continue

        const allToolCalls = conv.turns.flatMap((t) => t.toolCalls)
        const result = trajectoryMatcher.match(allToolCalls, scenario.options.assertions.toolCalls)
        trajectoryResults.set(conv.conversationId, result)
      }
    }

    // 3b. Per-turn trajectory assertions (scripted scenarios)
    const perTurnTrajectoryResults = new Map<string, PerTurnTrajectoryResult[]>()
    if (scenario.options.turns) {
      for (const conv of simulation.conversations) {
        if (conv.error) continue
        const turnResults: PerTurnTrajectoryResult[] = []
        for (const turn of conv.turns) {
          const scriptedTurn = scenario.options.turns[turn.turnIndex]
          if (scriptedTurn?.assertions?.toolCalls) {
            const result = trajectoryMatcher.match(
              turn.toolCalls,
              scriptedTurn.assertions.toolCalls,
            )
            turnResults.push({ turnIndex: turn.turnIndex, result })
          }
        }
        if (turnResults.length > 0) {
          perTurnTrajectoryResults.set(conv.conversationId, turnResults)
        }
      }
    }

    // 4. Collect and deduplicate errors
    const allFailures: FailureTurn[] = []
    for (const [convId, evaluation] of evaluations) {
      const failures = errorDetection.collectFailures(
        scenario.name,
        convId,
        evaluation.turnEvaluations,
      )
      allFailures.push(...failures)
    }

    let errors: UniqueError[] = []
    if (allFailures.length > 0) {
      this.emitProgress({
        scenario: scenario.name,
        phase: 'deduplicating',
        detail: `${label}${allFailures.length} failure(s)`,
      })
      errors = await errorDetection.deduplicate(allFailures)
    }

    // 5. Determine pass/fail
    const passed = this.determinePassFail(
      simulation,
      evaluations,
      trajectoryResults,
      perTurnTrajectoryResults,
      errors,
    )

    const scenarioResult: ScenarioResult = {
      scenario,
      simulation,
      evaluations,
      trajectoryResults,
      perTurnTrajectoryResults,
      errors,
      passed,
    }

    // Only emit onScenarioEnd in non-comparison mode (comparison has its own event)
    if (!agentLabel) {
      for (const reporter of this.reporters) {
        await reporter.onScenarioEnd?.(scenarioResult)
      }
    }

    return scenarioResult
  }

  private emitProgress(event: ProgressEvent): void {
    for (const reporter of this.reporters) {
      reporter.onProgress?.(event)
    }
  }

  private static formatPhaseLabel(phase: string): string {
    return phase === 'user-message'
      ? 'generating user message'
      : phase === 'agent-call'
        ? 'calling agent'
        : 'resolving tools'
  }

  private determinePassFail(
    simulation: SimulationResult,
    evaluations: Map<string, ConversationEvaluation>,
    trajectoryResults: Map<string, TrajectoryResult>,
    perTurnTrajectoryResults: Map<string, PerTurnTrajectoryResult[]>,
    errors: UniqueError[],
  ): boolean {
    // Fail if any conversation errored
    if (simulation.conversations.some((c) => c.error)) {
      return false
    }

    // Fail if any trajectory assertion failed
    for (const result of trajectoryResults.values()) {
      if (!result.matched) return false
    }

    // Fail if any per-turn trajectory assertion failed
    for (const turnResults of perTurnTrajectoryResults.values()) {
      if (turnResults.some((r) => !r.result.matched)) return false
    }

    // Fail if any errors meet or exceed the configured severity
    const severityOrder = ['low', 'medium', 'high', 'critical'] as const
    const failAtIndex = severityOrder.indexOf(this.config.failOnErrorSeverity)
    const failSeverities = new Set(severityOrder.slice(failAtIndex))
    if (errors.some((e) => failSeverities.has(e.severity))) {
      return false
    }

    // Check thresholds
    if (this.config.thresholds) {
      if (computeThresholdViolations(evaluations.values(), this.config.thresholds).length > 0) {
        return false
      }
    }

    return true
  }
}
