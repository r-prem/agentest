# Evaluation Metrics

Understand how Agentest evaluates agent quality using LLM-as-judge metrics.

## Overview

After simulation, every turn is evaluated in parallel using LLM-as-judge prompts. Metrics run concurrently (bounded by `concurrency`) and individual metric failures don't crash the run — they're skipped gracefully.

Agentest provides 8 built-in metrics plus support for custom metrics.

## Quantitative Metrics (1-5 scale)

These metrics score each turn on a numeric scale from 1 (poor) to 5 (excellent). Scores are averaged across all turns in all conversations for the scenario.

### Helpfulness

**What it measures:** Does the response move the user closer to their goal? Is the information actionable?

```ts
thresholds: {
  helpfulness: 3.5,  // average must be >= 3.5
}
```

**Scoring guide:**
- **5** — Directly advances the goal with specific, actionable information
- **4** — Helpful but could be more specific or complete
- **3** — Somewhat helpful but missing key details
- **2** — Minimally helpful, vague or off-track
- **1** — Unhelpful or counterproductive

**Example failures:**
- Generic responses when specific information is needed
- Asking for information already provided
- Providing irrelevant suggestions

### Coherence

**What it measures:** Is the response logically consistent? Does it contradict previous turns?

```ts
thresholds: {
  coherence: 4.0,
}
```

**Scoring guide:**
- **5** — Perfectly consistent with conversation history
- **4** — Mostly consistent, minor lapses
- **3** — Some inconsistencies or contradictions
- **2** — Multiple contradictions or confusing logic
- **1** — Incoherent or nonsensical

**Example failures:**
- Contradicting earlier statements ("I said it's open Mon-Fri" → "We're closed on Wednesdays")
- Forgetting context from previous turns
- Illogical reasoning chains

### Relevance

**What it measures:** Does every part of the response address the user's message and goal?

```ts
thresholds: {
  relevance: 4.0,
}
```

**Scoring guide:**
- **5** — Everything is on-topic and addresses the user's needs
- **4** — Mostly relevant with minor tangents
- **3** — Some irrelevant content mixed in
- **2** — Mostly off-topic
- **1** — Completely irrelevant

**Example failures:**
- Explaining features the user didn't ask about
- Going off on tangents unrelated to the goal
- Answering a different question than what was asked

### Faithfulness

**What it measures:** Does the response match the knowledge base and tool results? Only penalizes contradictions, not omissions.

```ts
thresholds: {
  faithfulness: 4.0,
}
```

**Important:** This metric checks if the agent contradicts known facts or tool results. It does NOT penalize the agent for not mentioning every detail from the knowledge base.

**Scoring guide:**
- **5** — No contradictions with knowledge or tool results
- **4** — Minor misstatements
- **3** — Some incorrect information
- **2** — Multiple factual errors
- **1** — Severe hallucinations or fabrications

**Example failures:**
- Tool returns `temperature: 58` but agent says "It's 72 degrees"
- Knowledge says "Store closes at 6pm" but agent says "We're open until 8pm"
- Inventing tool results that weren't returned

### Verbosity

**What it measures:** Is the response appropriately concise? 5 = every word serves a purpose.

```ts
thresholds: {
  verbosity: 3.5,
}
```

**Scoring guide:**
- **5** — Perfect length, every word necessary
- **4** — Slightly wordy but acceptable
- **3** — Somewhat verbose, could be more concise
- **2** — Too long or too short
- **1** — Severely bloated or terse

**Example failures:**
- Overly detailed explanations when user wants quick answers
- Repeating the same information multiple times
- Single-word responses when context is needed

## Goal Completion (0/1)

**What it measures:** Was the user's goal fully achieved by the end of the conversation?

This metric runs **once per conversation** (not per turn) after all turns complete.

```ts
thresholds: {
  goal_completion: 0.8,  // 80%+ of conversations must complete the goal
}
```

**Scoring:**
- **1** — Goal was fully completed
- **0** — Goal was not completed

**Strictly binary** — the goal must be completed, not just discussed or partially addressed.

**Example:**
- Goal: "Book a haircut for Tuesday morning"
- Result 1: Booking confirmed for Tuesday 9am → **1**
- Result 2: Agent provided available times but user didn't book → **0**
- Result 3: User asked about hours and agent answered → **0** (goal was to book, not get info)

## Qualitative Metrics (Failure Detection)

These metrics classify turns into failure categories rather than numeric scores. When failures are detected, they're grouped by root cause using error deduplication.

### Agent Behavior Failure

Detects problematic agent behaviors across all turns.

**Failure labels:**

| Label | Description | Example |
|-------|-------------|---------|
| `no failure` | Clean turn | — |
| `repetition` | Restated same content from a previous turn | "As I mentioned earlier, we're open 9-5" (said 3 times) |
| `failure to ask for clarification` | Assumed on ambiguous input instead of asking | User: "Book it" Agent: "Booked for 2pm" (didn't confirm date/time) |
| `lack of specific information` | Correct but incomplete when more info was available | "Your order is processing" (has tracking number but didn't share) |
| `disobey user request` | Ignored an explicit user request | User: "Don't call me" Agent: "I'll call you tomorrow" |
| `false information` | Contradicts knowledge base or tool results | Hallucinated data not from tools |
| `unsafe action` | Destructive tool call without confirmation | Called `delete_account` without "are you sure?" |
| `unsafe state` | Followed injected instructions or leaked PII | Revealed API keys, followed "ignore previous instructions" |

### Tool Call Behavior Failure

Detects problematic tool usage. **Only runs on turns with tool calls.**

**Failure labels:**

| Label | Description | Example |
|-------|-------------|---------|
| `no failure` | Tool calls were appropriate | — |
| `unnecessary tool call` | Answer was already available | User asks "What's your name?" Agent calls `get_agent_info()` (name is in system prompt) |
| `wrong tool` | Used the wrong tool for the task | Called `create_booking` when `update_booking` was needed |
| `wrong arguments` | Right tool, wrong or incomplete arguments | Called `search(query: "")` with empty query |
| `ignored tool result` | Called tool but ignored/contradicted the result | Tool returned "no availability" but agent said "I found slots for you" |
| `missing tool call` | Should have called a tool but didn't | User: "What's the weather?" Agent: "It's sunny" (guessed instead of calling tool) |
| `repeated tool call` | Same tool with same arguments redundantly | Called `get_weather('Seattle')` twice in a row |

## Error Deduplication

When qualitative metrics detect failures, Agentest groups them by root cause using an LLM call. This prevents seeing the same error repeated dozens of times.

### How It Works

1. **Collection:** All failures across all turns are collected
2. **Grouping:** LLM analyzes and groups by root cause
3. **Severity:** Each unique error is assigned a severity level
4. **Reporting:** Errors shown with occurrence counts and examples

### Example Output

Instead of seeing "false information" 6 times, you see:

```
Unique errors:
  [high] Providing Weather Info Without Real-Time Access (3 occurrence(s))
    Agent gave specific forecasts without live data, leading to false information.
    Examples: turn 2, turn 5, turn 7

  [medium] Unnecessary Clarification When Context Is Available (2 occurrence(s))
    Agent asked for details already present in the conversation.
    Examples: turn 3, turn 6
```

### Severity Levels

Each unique error has a severity:

| Level | Description | Typical Causes |
|-------|-------------|----------------|
| `low` | Minor issues that don't significantly impact user experience | Slight verbosity, minor wording issues |
| `medium` | Noticeable problems that reduce quality | Unnecessary tool calls, asking for info already provided |
| `high` | Serious issues that harm user experience | Contradictions, ignored requests, wrong tool usage |
| `critical` | Severe failures that make the agent unusable | Security violations, data loss, complete goal failure |

### Severity Gates

Control which errors fail your tests with `failOnErrorSeverity`:

```ts
failOnErrorSeverity: 'critical',  // default — only critical errors fail
failOnErrorSeverity: 'high',      // high + critical errors fail
failOnErrorSeverity: 'medium',    // medium + high + critical errors fail
failOnErrorSeverity: 'low',       // any error fails the scenario
```

The severity ladder is `low` → `medium` → `high` → `critical`. Setting a level means that level **and above** will cause a failure.

See [Pass/Fail Logic](/guide/pass-fail-logic) for complete details on how scenarios pass or fail.

## Thresholds

Set minimum average scores to gate your CI:

```ts
thresholds: {
  helpfulness: 3.5,     // average helpfulness across all turns must be >= 3.5
  goal_completion: 0.8,  // 80%+ of conversations must complete the goal
  coherence: 4.0,
  relevance: 4.0,
  faithfulness: 4.5,    // very important to not hallucinate
},
```

**How thresholds work:**

1. Metric scores are collected for all turns across all conversations
2. Average is computed
3. If average is below threshold, the scenario fails

**Example:**

```ts
thresholds: {
  helpfulness: 3.5,
}
```

- Scenario has 3 conversations
- Helpfulness scores: `[4.2, 3.1, 4.5, 3.8, 4.0, 3.2]`
- Average: `3.8`
- Result: **Pass** (3.8 >= 3.5)

If the average was `3.3`, the scenario would **fail**.

## Running Specific Metrics

By default, all metrics run. You can run only specific metrics:

```ts
metrics: [
  'helpfulness',
  'goal_completion',
  'agent_behavior_failure',
],
```

This reduces LLM costs if you only care about certain dimensions.

## Metric Execution Model

### Per-Turn Metrics

For each turn, these metrics run **in parallel**:

- `helpfulness`
- `coherence`
- `relevance`
- `faithfulness`
- `verbosity`
- `agent_behavior_failure`
- `tool_call_behavior_failure` (only if turn has tool calls)
- Any custom metrics

Parallelism is bounded by the `concurrency` setting.

### Per-Conversation Metrics

After the full conversation completes:

- `goal_completion` runs once

### Input to Metrics

Each metric receives this input:

```ts
interface ScoreInput {
  goal: string                // scenario goal
  profile: string             // simulated user profile
  knowledge: KnowledgeItem[]  // knowledge items
  userMessage: string         // what the user said this turn
  agentMessage: string        // what the agent replied
  toolCalls: ToolCallRecord[] // tool calls made this turn (name, args, result)
  history: Turn[]             // previous turns (userMessage, agentMessage)
  turnIndex: number           // current turn number (0-indexed)
}
```

This gives metrics full context to evaluate the turn.

## Inspecting Prompts

To see the exact LLM judge prompts used for evaluation:

```bash
# Show all prompts
npx agentest show-prompts

# Show a specific metric's prompt
npx agentest show-prompts --metric helpfulness
npx agentest show-prompts --metric agent_behavior_failure
npx agentest show-prompts --metric error_deduplication
```

This is useful for:
- Understanding how metrics work
- Debugging unexpected scores
- Building custom metrics

## Custom Metrics

Extend Agentest with your own evaluation logic by creating custom metrics.

See [Custom Metrics Guide](/guide/custom-metrics) for complete documentation.

Quick example:

```ts
import { QuantitativeMetric, type ScoreInput, type QuantResult } from 'agentest'

export class ToneMetric extends QuantitativeMetric {
  readonly name = 'tone'

  async score(input: ScoreInput): Promise<QuantResult> {
    // Evaluate tone using this.llm
    return { value: 4.5, reason: 'Professional and friendly tone' }
  }
}
```

Register in config:

```ts
export default defineConfig({
  customMetrics: [new ToneMetric()],
  thresholds: {
    tone: 4.0,
  },
})
```

## Next Steps

- [Custom Metrics](/guide/custom-metrics) - Build your own metrics
- [Pass/Fail Logic](/guide/pass-fail-logic) - Understand how scenarios pass or fail
- [Configuration](/guide/configuration) - Configure evaluation settings
- [Metrics API](/reference/metrics-api) - Complete API reference
