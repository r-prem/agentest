// Config
export { defineConfig } from './config/defineConfig.js'
export { DEFAULT_MODEL } from './config/schema.js'
export type { AgentestConfig, AgentestConfigInput, CustomAgentHandler } from './config/schema.js'

// Scenario
export { scenario, getRegisteredScenarios, clearScenarioRegistry } from './scenario/scenario.js'
export { sequence } from './scenario/mocks.js'
export { AgentestError, MockResolver } from './scenario/mocks.js'
export type {
  Scenario,
  ScenarioOptions,
  ToolMockFn,
  ToolCallRecord,
  ToolCallAssertion,
  ForbiddenToolAssertion,
  TrajectoryAssertions,
  KnowledgeItem,
} from './scenario/types.js'

// LLM
export { createProvider } from './llm/provider.js'
export type { LLMProvider, GenerateTextOptions, GenerateObjectOptions, ProviderName, ProviderOptions } from './llm/provider.js'

// Simulator
export { Simulator } from './simulator/simulator.js'
export { AgentClient } from './simulator/agentClient.js'
export { SimulatedUser } from './simulator/simulatedUser.js'
export type {
  SimulationResult,
  ConversationRecord,
  TurnRecord,
} from './simulator/simulator.js'
export type { ChatMessage, ToolCall, AgentResponse } from './simulator/agentClient.js'

// Evaluator
export { Evaluator } from './evaluator/evaluator.js'
export type { TurnEvaluation, ConversationEvaluation, MetricName } from './evaluator/evaluator.js'
export { TrajectoryMatcher } from './evaluator/trajectory.js'
export type { TrajectoryResult } from './evaluator/trajectory.js'
export { ErrorDetection } from './evaluator/errorDetection.js'
export type { FailureTurn, UniqueError } from './evaluator/errorDetection.js'

// Metrics
export {
  QuantitativeMetric,
  QualitativeMetric,
  ConversationMetric,
} from './evaluator/metrics/base.js'
export type {
  ScoreInput,
  ConversationScoreInput,
  QuantResult,
  QualResult,
} from './evaluator/metrics/base.js'
export { HelpfulnessMetric } from './evaluator/metrics/helpfulness.js'
export { CoherenceMetric } from './evaluator/metrics/coherence.js'
export { RelevanceMetric } from './evaluator/metrics/relevance.js'
export { FaithfulnessMetric } from './evaluator/metrics/faithfulness.js'
export { VerbosityMetric } from './evaluator/metrics/verbosity.js'
export { GoalCompletionMetric } from './evaluator/metrics/goalCompletion.js'
export { AgentBehaviorFailureMetric } from './evaluator/metrics/agentBehaviorFailure.js'
export { ToolCallBehaviorFailureMetric } from './evaluator/metrics/toolCallBehaviorFailure.js'

// Prompts
export { renderPrompt, formatHistory, formatToolCalls, formatToolCallSignatures, formatToolResults, formatKnowledge, wrapContent } from './evaluator/prompts.js'

// Scoring
export { computeTurnAverages, computeMetricAverages } from './evaluator/scoring.js'

// Runner
export { Runner } from './runner/runner.js'
export type { ScenarioResult, RunResult, ComparisonAgentResult, ComparisonScenarioResult, ComparisonRunResult } from './runner/runner.js'
export { discoverScenarioFiles, loadScenarioFile, discoverAndLoad } from './runner/discovery.js'
export type { DiscoveryResult } from './runner/discovery.js'

// Reporters
export { ConsoleReporter } from './runner/reporters/console.js'
export { JsonReporter } from './runner/reporters/json.js'
export { GitHubActionsReporter } from './runner/reporters/githubActions.js'
export type { Reporter, ProgressEvent } from './runner/reporters/types.js'
