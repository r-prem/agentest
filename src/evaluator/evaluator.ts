import pLimit from 'p-limit'
import type { LLMProvider } from '../llm/provider.js'
import type { ScenarioOptions, ToolCallRecord, KnowledgeItem } from '../scenario/types.js'
import type { TurnRecord } from '../simulator/simulator.js'
import {
  QuantitativeMetric,
  QualitativeMetric,
  ConversationMetric,
  type ScoreInput,
  type ConversationScoreInput,
  type QuantResult,
  type QualResult,
} from './metrics/base.js'
import { HelpfulnessMetric } from './metrics/helpfulness.js'
import { CoherenceMetric } from './metrics/coherence.js'
import { RelevanceMetric } from './metrics/relevance.js'
import { FaithfulnessMetric } from './metrics/faithfulness.js'
import { VerbosityMetric } from './metrics/verbosity.js'
import { GoalCompletionMetric } from './metrics/goalCompletion.js'
import { AgentBehaviorFailureMetric } from './metrics/agentBehaviorFailure.js'
import { ToolCallBehaviorFailureMetric } from './metrics/toolCallBehaviorFailure.js'

export type MetricName =
  | 'helpfulness'
  | 'coherence'
  | 'relevance'
  | 'faithfulness'
  | 'verbosity'
  | 'goal_completion'
  | 'agent_behavior_failure'
  | 'tool_call_behavior_failure'

export interface TurnEvaluation {
  turnIndex: number
  metrics: Record<string, QuantResult | QualResult>
}

export interface ConversationEvaluation {
  turnEvaluations: TurnEvaluation[]
  goalCompletion: QuantResult | null
}

const BUILTIN_TURN_METRICS: Record<string, () => QuantitativeMetric | QualitativeMetric> = {
  helpfulness: () => new HelpfulnessMetric(),
  coherence: () => new CoherenceMetric(),
  relevance: () => new RelevanceMetric(),
  faithfulness: () => new FaithfulnessMetric(),
  verbosity: () => new VerbosityMetric(),
  agent_behavior_failure: () => new AgentBehaviorFailureMetric(),
  tool_call_behavior_failure: () => new ToolCallBehaviorFailureMetric(),
}

export class Evaluator {
  private turnMetrics: (QuantitativeMetric | QualitativeMetric)[] = []
  private goalCompletionMetric: GoalCompletionMetric | null = null
  private customMetrics: (QuantitativeMetric | QualitativeMetric)[] = []
  private limit: ReturnType<typeof pLimit>

  constructor(
    private llm: LLMProvider,
    metricNames: MetricName[] | undefined,
    customMetrics: Array<{ name: string; setLLM: (llm: LLMProvider) => void }> | undefined,
    concurrency: number,
  ) {
    this.limit = pLimit(concurrency)

    const enabledMetrics = metricNames ?? (Object.keys(BUILTIN_TURN_METRICS) as MetricName[])

    for (const name of enabledMetrics) {
      if (name === 'goal_completion') {
        this.goalCompletionMetric = new GoalCompletionMetric()
        this.goalCompletionMetric.setLLM(llm)
        continue
      }

      const factory = BUILTIN_TURN_METRICS[name]
      if (factory) {
        const metric = factory()
        metric.setLLM(llm)
        this.turnMetrics.push(metric)
      }
    }

    if (customMetrics) {
      for (const metric of customMetrics) {
        if (!(metric instanceof QuantitativeMetric) && !(metric instanceof QualitativeMetric)) {
          console.warn(
            `[agentest] Custom metric "${metric.name}" does not extend QuantitativeMetric or QualitativeMetric — skipping`,
          )
          continue
        }
        metric.setLLM(llm)
        this.customMetrics.push(metric)
      }
    }
  }

  async evaluateConversation(
    turns: TurnRecord[],
    scenario: ScenarioOptions,
  ): Promise<ConversationEvaluation> {
    // Evaluate all turns in parallel
    const turnEvaluations = await Promise.all(
      turns.map((turn, i) => this.evaluateTurn(turn, turns.slice(0, i), scenario)),
    )

    // Goal completion runs once per conversation (skip when no goal is defined)
    let goalCompletion: QuantResult | null = null
    if (this.goalCompletionMetric && scenario.goal) {
      const input: ConversationScoreInput = {
        goal: scenario.goal,
        profile: scenario.profile ?? 'A user testing the agent',
        knowledge: scenario.knowledge ?? [],
        turns: turns.map((t) => ({
          userMessage: t.userMessage,
          agentMessage: t.agentMessage,
          toolCalls: t.toolCalls,
        })),
      }
      goalCompletion = await this.limit(() => this.goalCompletionMetric!.score(input))
    }

    return { turnEvaluations, goalCompletion }
  }

  private async evaluateTurn(
    turn: TurnRecord,
    previousTurns: TurnRecord[],
    scenario: ScenarioOptions,
  ): Promise<TurnEvaluation> {
    const input: ScoreInput = {
      goal: scenario.goal ?? 'Respond to the user query accurately',
      profile: scenario.profile ?? 'A user testing the agent',
      knowledge: scenario.knowledge ?? [],
      userMessage: turn.userMessage,
      agentMessage: turn.agentMessage,
      toolCalls: turn.toolCalls,
      history: previousTurns.map((t) => ({
        userMessage: t.userMessage,
        agentMessage: t.agentMessage,
      })),
      turnIndex: turn.turnIndex,
    }

    const hasToolCalls = turn.toolCalls.length > 0

    // Filter out tool_call_behavior_failure if no tool calls this turn
    const metricsToRun = this.turnMetrics.filter(
      (m) => m.name !== 'tool_call_behavior_failure' || hasToolCalls,
    )

    const allMetrics = [...metricsToRun, ...this.customMetrics]

    // Run all metrics for this turn in parallel
    const results = await Promise.allSettled(
      allMetrics.map((metric) =>
        this.limit(async () => {
          if (metric instanceof QuantitativeMetric) {
            return { name: metric.name, result: await metric.score(input) }
          } else {
            return {
              name: metric.name,
              result: await (metric as QualitativeMetric).evaluate(input),
            }
          }
        }),
      ),
    )

    const metrics: Record<string, QuantResult | QualResult> = {}
    for (let i = 0; i < results.length; i++) {
      const settled = results[i]
      if (settled.status === 'fulfilled') {
        metrics[settled.value.name] = settled.value.result
      } else {
        const metricName = allMetrics[i]?.name ?? 'unknown'
        console.warn(
          `[agentest] Metric "${metricName}" failed at turn ${turn.turnIndex}: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
        )
        metrics[metricName] = {
          value: `error: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
          reason: `Metric evaluation failed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
        } as QualResult
      }
    }

    return { turnIndex: turn.turnIndex, metrics }
  }
}
