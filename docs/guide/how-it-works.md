# How It Works

Understand the execution model behind Agentest's agent simulation and evaluation.

## The Simulation Loop

```
┌─ SimulatedUser (LLM) generates a message
│
├─ Agentest POSTs message to your agent endpoint
│
├─ Agent responds with tool_calls?
│  ├─ YES → MockResolver resolves each tool call
│  │        Results injected back → POST again
│  │        (loop until agent returns text)
│  └─ NO  → Record the text response
│
├─ SimulatedUser sees agent's reply
│  ├─ Goal achieved? → stop
│  └─ Continue → next turn
│
└─ After all turns: evaluate with LLM-as-judge metrics
```

Agentest owns the tool-call loop. It intercepts tool calls from the agent response, resolves them through your mocks, and sends results back. **No instrumentation needed in your agent code** — your agent just sees normal tool results.

## Detailed Flow

### 1. Configuration Loading

When you run `npx agentest run`, Agentest:

1. Discovers `agentest.config.ts` (or `.yaml`) in your project root
2. Validates the configuration with Zod schemas
3. Interpolates environment variables (`${VAR}` syntax)
4. Sets up the LLM provider for simulation and evaluation

### 2. Scenario Discovery

Agentest finds all scenario files using glob patterns:

- Default: `**/*.sim.ts`
- Excludes: `node_modules/**`
- Uses [jiti](https://github.com/unjs/jiti) to import TypeScript files directly (no build step)

### 3. Simulation Execution

For each scenario, Agentest runs `conversationsPerScenario` independent conversations (default: 3).

Each conversation proceeds as follows:

#### Turn Loop

```ts
for (turn = 1; turn <= maxTurns; turn++) {
  // 1. SimulatedUser generates a message
  const userMessage = await simulatedUser.generateMessage(history)

  // 2. Send to agent endpoint
  let agentResponse = await agentClient.sendMessage([...history, userMessage])

  // 3. Tool call resolution loop
  while (agentResponse.tool_calls) {
    const toolResults = []

    for (const toolCall of agentResponse.tool_calls) {
      // Resolve through mock
      const result = mockResolver.resolve(toolCall.name, toolCall.arguments)
      toolResults.push({ tool_call_id: toolCall.id, result })
    }

    // Inject results and call agent again
    agentResponse = await agentClient.sendMessage([
      ...history,
      agentResponse,
      { role: 'tool', content: toolResults }
    ])
  }

  // 4. Record the turn
  history.push(userMessage, agentResponse)

  // 5. Check if goal is met
  const shouldStop = await simulatedUser.checkGoalCompletion(history)
  if (shouldStop) break
}
```

#### Key Points

- **Mock state resets** at the start of each conversation (so `sequence()` mocks start fresh)
- **Tool calls are synchronous** from the agent's perspective (one turn = multiple tool calls resolved)
- **Simulated user decides** when to stop based on goal completion
- **Unmocked tools** throw `AgentestError` by default (or passthrough if configured)

### 4. Evaluation

After all conversations complete, Agentest evaluates each turn:

#### Per-Turn Metrics

For each turn, all configured metrics run **in parallel** (bounded by `concurrency`):

```ts
const metrics = await Promise.all([
  helpfulness.score(input),
  coherence.score(input),
  relevance.score(input),
  faithfulness.score(input),
  verbosity.score(input),
  agentBehaviorFailure.evaluate(input),
  toolCallBehaviorFailure.evaluate(input), // only if turn has tool calls
  ...customMetrics.map(m => m.score(input)),
])
```

Each metric receives:

```ts
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

#### Per-Conversation Metrics

`goal_completion` runs once after the full conversation:

```ts
const goalCompletion = await goalCompletionMetric.score({
  goal,
  profile,
  fullConversationHistory,
})
```

#### Trajectory Matching

Trajectory assertions are **deterministic** (no LLM calls):

```ts
const trajectoryResult = trajectoryMatcher.match(
  actualToolCalls,
  scenario.assertions.toolCalls
)
```

Checks:
- Match mode (`strict`, `unordered`, `contains`, `within`)
- Argument matching (`exact`, `partial`, `ignore`)

Returns:
- `matched: boolean`
- `missingCalls: string[]`
- `extraCalls: string[]`
- `orderingIssues: string[]`

### 5. Error Deduplication

After evaluation, qualitative metric failures are grouped by root cause:

```ts
const uniqueErrors = await errorDeduplicator.deduplicate(allFailures)
```

This LLM call produces:

```ts
interface UniqueError {
  label: string          // "Providing weather info without real-time access"
  description: string    // Detailed explanation
  severity: 'low' | 'medium' | 'high' | 'critical'
  occurrences: number
  examples: TurnResult[]
}
```

### 6. Pass/Fail Logic

A scenario **passes** when:

1. No conversation threw an error
2. All trajectory assertions matched
3. No errors at or above `failOnErrorSeverity`
4. All metric averages meet configured thresholds

A scenario **fails** if any condition is violated.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Runner                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Discovery   │  │  Simulator   │  │  Evaluator   │          │
│  │  *.sim.ts    │→ │  Multi-turn  │→ │  Metrics +   │          │
│  │  files       │  │  loop        │  │  Trajectory  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Reporters                            │  │
│  │  Console  │  JSON  │  GitHub Actions                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

           ↓                    ↓                    ↓

  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │ Simulated   │      │  Agent      │      │  Judge LLM  │
  │ User (LLM)  │  →   │  Endpoint   │  ←   │  (Metrics)  │
  └─────────────┘      └─────────────┘      └─────────────┘
         ↑                     ↑
         │                     │
    ┌─────────────────────────┘
    │   MockResolver
    │   (Tool calls → Mocks)
    └─────────────────────────
```

## Concurrency Model

Agentest runs scenarios in parallel, bounded by the `concurrency` setting:

```ts
const results = await pLimit(config.concurrency).map(
  scenarios,
  scenario => simulator.runScenario(scenario)
)
```

Within each scenario:
- Conversations run **sequentially** (to maintain conversation state isolation)
- Evaluation metrics run **in parallel per turn** (each metric is independent)

This balances throughput with resource usage. Typical settings:

- `concurrency: 20` — good for cloud LLM APIs with high rate limits
- `concurrency: 5` — better for local LLMs or strict rate limits

## Next Steps

- [Configuration](/guide/configuration) - Configure simulation and evaluation settings
- [Scenarios](/guide/scenarios) - Write realistic test scenarios
- [Mocks](/guide/mocks) - Control tool behavior
