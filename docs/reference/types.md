# Type Definitions

TypeScript type reference for Agentest.

## Configuration Types

```ts
interface AgentConfig {
  type?: 'chat_completions' | 'custom'
  name: string
  endpoint?: string
  headers?: Record<string, string>
  body?: Record<string, any>
  streaming?: boolean
  handler?: (messages: ChatMessage[]) => Promise<ChatMessage>
}

interface Config {
  agent: AgentConfig
  provider?: string
  model?: string
  providerOptions?: { baseURL?: string; apiKey?: string }
  conversationsPerScenario?: number
  maxTurns?: number
  concurrency?: number
  metrics?: string[]
  thresholds?: Record<string, number>
  failOnErrorSeverity?: 'low' | 'medium' | 'high' | 'critical'
  customMetrics?: Metric[]
  include?: string[]
  exclude?: string[]
  reporters?: Array<'console' | 'json' | 'github-actions'>
  unmockedTools?: 'error' | 'passthrough'
  compare?: AgentConfig[]
}
```

## Scenario Types

```ts
interface ScenarioOptions {
  profile: string
  goal: string
  knowledge?: KnowledgeItem[]
  mocks?: { tools: Record<string, ToolMockFn> }
  assertions?: { toolCalls?: TrajectoryAssertion }
  conversationsPerScenario?: number
  maxTurns?: number
  userPromptTemplate?: string
}

interface KnowledgeItem {
  content: string
}

type ToolMockFn = (
  args: Record<string, unknown>,
  ctx: MockContext
) => unknown | Promise<unknown>

interface MockContext {
  callIndex: number
  conversationId: string
  turnIndex: number
}
```

## Message Types

```ts
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}
```

## Result Types

```ts
interface SimulationResult {
  scenarioId: string
  scenarioName: string
  conversations: ConversationResult[]
  summary: ScenarioSummary
}

interface ConversationResult {
  conversationId: string
  turns: TurnResult[]
  goalCompletion: { score: 0 | 1; reason: string }
  trajectoryMatch: TrajectoryResult | null
  passed: boolean
}

interface TurnResult {
  turnIndex: number
  userMessage: string
  agentMessage: string
  toolCalls: ToolCallRecord[]
  metrics: Record<string, QuantResult | QualResult>
}
```

## Metric Types

```ts
interface QuantResult {
  value: number
  reason: string
}

interface QualResult {
  value: string
  reason: string
}

interface ScoreInput {
  goal: string
  profile: string
  knowledge: KnowledgeItem[]
  userMessage: string
  agentMessage: string
  toolCalls: ToolCallRecord[]
  history: Turn[]
  turnIndex: number
}
```
