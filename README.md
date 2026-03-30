<p align="center">
  <img src="assets/agentest-logo.svg" alt="Agentest Logo" width="250" />
</p>

# Agentest

**Vitest for AI agents.** Scenario-based testing with simulated users, tool-call mocks, and LLM-as-judge evaluation. Lives in your project like Playwright. Run with `npx agentest run`.

**[Documentation](https://r-prem.github.io/agentest/)** | **[Getting Started](https://r-prem.github.io/agentest/guide/getting-started)** | **[Examples](https://r-prem.github.io/agentest/examples/basic-scenario)** | **[Demos](demos/)**

Agentest spins up LLM-powered simulated users that talk to your agent, intercepts tool calls through mocks, and evaluates every turn with LLM-as-judge metrics — all without touching your agent's code.

```bash
npm install @agentesting/agentest --save-dev
```

### Prerequisites

- **Node.js >= 20**
- **A running agent** — either an HTTP endpoint that accepts OpenAI-compatible chat completions requests, or any agent you can call from a TypeScript function (see [Custom Handler](#custom-handler))
- **An LLM API key** — Agentest uses an LLM for the simulated user and evaluation judges. Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` depending on your configured provider. Alternatively, use a [local LLM](#local-llms) for zero-cost development.

### Features

| | |
|---|---|
| Scenario-based tests | Define user personas, goals, and knowledge — Agentest generates realistic multi-turn conversations |
| Tool-call mocks | Intercept and control tool calls with functions, sequences, and error simulation |
| Trajectory assertions | Verify tool call order and arguments with `strict`, `contains`, `unordered`, and `within` match modes |
| LLM-as-judge metrics | Helpfulness, coherence, relevance, faithfulness, goal completion, behavior failure detection |
| Comparison mode | Run the same scenarios against multiple models/configs side-by-side |
| CI-ready CLI | Exit codes, JSON reporter, GitHub Actions annotations, watch mode |
| Custom handler | Bring any agent — HTTP endpoint or in-process function. Works with any framework |

---

## Why This Is Needed

**The problem: testing agents is not like testing regular APIs.**

Traditional API tests send a request and assert on the response. Agent tests need to handle multi-turn conversations where the agent decides which tools to call, in what order, with what arguments — and the "correct" output is subjective.

**How current tools fall short:**

- **Eval platforms** (DeepEval, LangSmith, Langfuse) are great at scoring outputs after the fact, but they don't *run* your agent through realistic conversations. You still need to manually generate test data or replay logged traces.
- **Agent frameworks** (LangChain, CrewAI) give you building blocks but no built-in test runner. Testing means writing custom scripts for every scenario.
- **No good CLI runner** exists that combines simulated users, tool mocking, trajectory assertions, and evaluation in a single `npx` command — the way Vitest does for unit tests.

**How Agentest works:**

```
┌─ You define: persona + goal + knowledge + tool mocks + assertions
│
├─ Agentest creates a simulated user (LLM) that talks to your agent
│
├─ Tool calls are intercepted and resolved through your mocks
│  (check_availability → { slots: ['09:00', '10:30'] })
│  (create_booking → { success: true, bookingId: 'BK-001' })
│
├─ Trajectory assertions verify the agent called the right tools
│  (matchMode: 'contains', expected: [check_availability, create_booking])
│
└─ LLM-as-judge evaluates every turn: helpfulness, coherence, goal completion, ...
```

Agentest complements eval platforms and observability tools — it doesn't replace them. Use Agentest to *run* your agent through test scenarios in CI. Use LangSmith/Langfuse to *observe* your agent in production.

---

## Agentest vs. Other Tools

Agentest is a **test runner**, not an eval framework or observability platform. Here's how it compares:

| Capability | Agentest | DeepEval | LangSmith | Langfuse |
|---|---|---|---|---|
| **Primary purpose** | Test runner for agents | Eval framework for LLM outputs | Observability + eval platform | Observability + eval platform |
| **Simulated users** | Built-in (LLM-powered personas with goals) | -- | -- | -- |
| **Tool-call mocking** | Built-in (functions, sequences, error sim) | -- | -- | -- |
| **Trajectory assertions** | Built-in (strict/contains/unordered/within) | -- | -- | -- |
| **LLM-as-judge eval** | Built-in (8 metrics + custom) | Built-in (extensive metric library) | Built-in | Built-in |
| **Multi-turn conversation testing** | Native (agent loop with mock resolution) | Manual test case setup | Trace replay | Trace replay |
| **Comparison mode** | Built-in (side-by-side model comparison) | Experiment tracking | Experiment tracking | Experiment tracking |
| **CI/CLI integration** | `npx agentest run` with exit codes | `deepeval test run` | SDK-based | SDK-based |
| **Production observability** | -- | -- | Tracing, logging, monitoring | Tracing, logging, monitoring |
| **Dataset management** | -- | Built-in | Built-in | Built-in |
| **Annotation/feedback UI** | -- | -- | Built-in | Built-in |
| **Pricing** | Open source (MIT) | Open source + cloud | Freemium SaaS | Open source + cloud |
| **Language** | TypeScript/Node.js | Python | Python (primary) | Python/JS SDKs |

**When to use what:**

- **Agentest** — You want to write `.sim.ts` scenario files that test your agent end-to-end in CI, like writing Vitest tests. No manual test data, no trace replay.
- **DeepEval** — You have existing datasets of input/output pairs and want to evaluate LLM output quality with a wide library of metrics.
- **LangSmith / Langfuse** — You need production tracing, logging, user feedback collection, and dataset management alongside evaluation.

These tools are complementary. Run Agentest in CI to catch regressions before deploy. Use LangSmith/Langfuse to monitor and evaluate in production.

---

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
  - [Agent Configuration](#agent-configuration)
  - [LLM Provider](#llm-provider)
  - [Simulation Parameters](#simulation-parameters)
  - [Evaluation](#evaluation)
  - [File Discovery](#file-discovery)
  - [Reporters](#reporters)
  - [Full Config Example](#full-config-example)
- [Scenarios](#scenarios)
  - [Profile & Goal](#profile--goal)
  - [Knowledge](#knowledge)
  - [Overriding Global Settings](#overriding-global-settings)
- [Mocks](#mocks)
  - [Function Mocks](#function-mocks)
  - [Sequence Mocks](#sequence-mocks)
  - [Error Simulation](#error-simulation)
  - [Unmocked Tools](#unmocked-tools)
- [Trajectory Assertions](#trajectory-assertions)
  - [Match Modes](#match-modes)
  - [Argument Matching](#argument-matching)
- [Evaluation Metrics](#evaluation-metrics)
  - [Quantitative Metrics](#quantitative-metrics)
  - [Qualitative Metrics](#qualitative-metrics)
  - [Thresholds](#thresholds)
  - [Error Deduplication](#error-deduplication)
  - [Custom Metrics](#custom-metrics)
- [CLI](#cli)
- [YAML Config](#yaml-config)
- [Prompt Template Customization](#prompt-template-customization)
- [Comparison Mode](#comparison-mode)
- [Framework Compatibility](#framework-compatibility)
- [Vitest Integration](#vitest-integration)
- [Watch Mode](#watch-mode)
- [Local LLMs](#local-llms)
- [Pass/Fail Logic](#passfail-logic)
- [Demos](#demos)
- [Programmatic Usage](#programmatic-usage)
- [Understanding LLM Usage](#understanding-llm-usage)
- [Requirements](#requirements)
- [License](#license)

## Install

```bash
npm install @agentesting/agentest --save-dev
```

## Quick Start

### 1. Create a config file

```ts
// agentest.config.ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  agent: {
    name: 'my-agent',
    endpoint: 'http://localhost:3000/api/chat',
  },
})
```

### 2. Write a scenario

```ts
// tests/booking.sim.ts
import { scenario, sequence } from '@agentesting/agentest'

scenario('user books a morning slot', {
  profile: 'Busy professional who prefers mornings.',
  goal: 'Book a haircut for next Tuesday morning.',

  knowledge: [
    { content: 'The salon is open Tuesday 08:00-18:00.' },
    { content: 'Standard haircut takes 45 minutes.' },
  ],

  mocks: {
    tools: {
      check_availability: (args) => ({
        available: true,
        slots: ['09:00', '09:45', '10:30'],
        date: args.date,
      }),
      create_booking: sequence([
        { success: true, bookingId: 'BK-001', confirmationSent: true },
      ]),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    },
  },
})
```

### 3. Run

```bash
# If your agent runs on localhost, allow private endpoints:
AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1 npx agentest run
```

Output:

```
Agentest running 1 scenario(s)

  ⠹ user books a morning slot → simulating conv-1-a3f8b2c1 turn 1/8 — calling agent

✓ user books a morning slot
  ✓ conv-1-a3f8b2c1 (2 turns, goal met, trajectory matched, helpfulness: 4.5, coherence: 5.0)
  ✓ conv-2-d9e1f4a7 (1 turns, goal met, trajectory matched, helpfulness: 5.0, coherence: 5.0)

1/1 scenarios passed
```

---

## How It Works

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

Agentest owns the tool-call loop. It intercepts tool calls from the agent response, resolves them through your mocks, and sends results back. No instrumentation needed in your agent code — your agent just sees normal tool results.

---

## Configuration

Create `agentest.config.ts` (or `agentest.config.yaml`) in your project root. Agentest auto-detects the format. You can also pass a custom path with `--config`.

```ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  // ... options
})
```

`defineConfig` validates the config with Zod and interpolates environment variables in headers. See [YAML Config](#yaml-config) for the YAML equivalent.

### Agent Configuration

Agentest supports two agent types: **chat completions** (HTTP endpoint) and **custom** (bring your own handler function).

#### Chat Completions (default)

```ts
agent: {
  name: 'my-agent',
  endpoint: 'https://api.example.com/chat',

  // Optional
  type: 'chat_completions',   // default
  headers: {
    Authorization: 'Bearer ${AGENT_API_KEY}',  // interpolated from process.env
    'X-Custom': 'value',
  },
  body: {
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
    ],
  },
}
```

**`endpoint`** must be an HTTP/HTTPS URL that accepts OpenAI-compatible chat completions requests. Agentest POSTs `{ messages: [...] }` and expects `{ choices: [{ message: { content, tool_calls? } }] }` in return.

**`headers`** supports `${VAR}` syntax for environment variable interpolation. If a referenced variable is not set, config loading fails with a clear error. This keeps secrets out of your config files.

**`body`** is shallow-merged into every request. Use it to set model, temperature, system messages, or any extra fields your endpoint expects. The `messages` array in `body` is prepended to conversation messages (useful for system prompts).

**`streaming`** enables SSE (Server-Sent Events) streaming mode. When `true`, Agentest sends `stream: true` in the request body and parses the chunked SSE response, accumulating `delta.content` and `delta.tool_calls` into a complete message. Use this when your agent endpoint streams by default:

```ts
agent: {
  name: 'my-agent',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  streaming: true,
  headers: { Authorization: 'Bearer ${OPENAI_API_KEY}' },
  body: { model: 'gpt-4o' },
}
```

#### Custom Handler

Use `type: 'custom'` to connect any agent — no HTTP endpoint or OpenAI-compatible API required. You provide a function that receives messages and returns a response:

```ts
import { defineConfig, type ChatMessage } from '@agentesting/agentest'
import { myAgent } from './src/agent.js'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'my-agent',
    handler: async (messages: ChatMessage[]) => {
      // Call your agent however you want
      const result = await myAgent.chat(messages)
      return {
        role: 'assistant' as const,
        content: result.text,
        // Optional: return tool_calls if your agent uses tools
        // tool_calls: [{ id: '...', type: 'function', function: { name: '...', arguments: '...' } }]
      }
    },
  },
})
```

The handler receives the full message history (same `ChatMessage` format used internally) and must return an assistant message. If the response includes `tool_calls`, Agentest runs them through mocks and calls your handler again with the tool results — the same loop as with HTTP endpoints.

This is useful when your agent:
- Uses a non-OpenAI API (Anthropic, Google, custom protocols)
- Runs in-process (no HTTP server needed)
- Needs custom request/response mapping
- Uses an SDK or framework with its own calling convention

### LLM Provider

The LLM provider is used for the **simulated user** and **evaluation judges** — not for your agent.

```ts
// Cloud providers
provider: 'anthropic',                     // default
model: 'claude-sonnet-4-20250514',         // default

provider: 'openai',
model: 'gpt-4o',

provider: 'google',
model: 'gemini-2.0-flash',

// Local providers
provider: 'ollama',
model: 'llama3.2',
// defaults to http://localhost:11434/v1

provider: 'openai-compatible',
model: 'my-model',
providerOptions: {
  baseURL: 'http://localhost:1234/v1',     // required for openai-compatible
  apiKey: 'optional-key',                  // optional, defaults to 'not-needed'
},
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | `'claude-sonnet-4-20250514'` | Model ID passed to the provider |
| `provider` | `string` | `'anthropic'` | `'anthropic'`, `'openai'`, `'google'`, `'ollama'`, `'openai-compatible'` |
| `providerOptions.baseURL` | `string` | — | Base URL override. Required for `openai-compatible`, optional for `ollama` (defaults to `http://localhost:11434/v1`) |
| `providerOptions.apiKey` | `string` | — | API key override. For local LLMs this is typically not needed |

**Environment variables:** Cloud providers read API keys from the standard environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`). You don't need to configure these in Agentest.

### Simulation Parameters

```ts
conversationsPerScenario: 3,  // run 3 independent conversations per scenario
maxTurns: 8,                  // max user↔agent exchanges per conversation
concurrency: 20,              // max parallel LLM calls across all scenarios
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `conversationsPerScenario` | `number` | `3` | How many independent conversations to run per scenario. More conversations = more statistical confidence, but more LLM cost |
| `maxTurns` | `number` | `8` | Upper bound on user↔agent exchanges. The simulated user can stop earlier if the goal is met |
| `concurrency` | `number` | `20` | Max parallel LLM calls. Controls both simulation and evaluation parallelism. Lower this if you're hitting rate limits |

Both `conversationsPerScenario` and `maxTurns` can be overridden per-scenario.

### Evaluation

```ts
// Run only specific metrics (default: all)
metrics: ['helpfulness', 'goal_completion', 'agent_behavior_failure'],

// Set minimum score thresholds (fail the run if average is below)
thresholds: {
  helpfulness: 3.5,
  goal_completion: 0.7,
  coherence: 4.0,
},
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metrics` | `string[]` | all 8 metrics | Which evaluation metrics to run. Omit to run all |
| `thresholds` | `Record<string, number>` | `{}` | Minimum average scores per metric. Values are 0-5. If any metric's average across all conversations falls below its threshold, the run fails |
| `failOnErrorSeverity` | `string` | `'critical'` | Minimum error severity that fails a scenario. One of `'low'`, `'medium'`, `'high'`, `'critical'` |
| `customMetrics` | `array` | `[]` | Custom metric instances (see [Custom Metrics](#custom-metrics)) |

### File Discovery

```ts
include: ['**/*.sim.ts'],      // glob patterns for scenario files
exclude: ['node_modules/**'],  // glob patterns to ignore
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string[]` | `['**/*.sim.ts']` | Glob patterns to find scenario files. Relative to the working directory |
| `exclude` | `string[]` | `['node_modules/**']` | Glob patterns to exclude from discovery |

Scenario files are TypeScript files that call `scenario()` when imported. Agentest uses [jiti](https://github.com/unjs/jiti) to import them directly — no build step needed.

### Reporters

```ts
reporters: ['console', 'json'],
```

| Reporter | Description |
|----------|-------------|
| `console` | Colored pass/fail output with live progress spinner, metric scores, and error summaries. Default. |
| `json` | Writes full results to `.agentest/results.json` including all turns, evaluations, and errors |
| `github-actions` | Writes a markdown summary table to `$GITHUB_STEP_SUMMARY` and emits `::error`/`::warning`/`::notice` annotations that surface inline on PRs |

The `console` reporter shows a live spinner during simulation and evaluation so you can see what's happening. In non-TTY environments (CI), it falls back to line-by-line progress output.

### Unmocked Tools

```ts
unmockedTools: 'error',       // default: throw AgentestError
unmockedTools: 'passthrough', // return undefined (no-op)
```

Controls what happens when the agent calls a tool that has no mock defined. See [Unmocked Tools](#unmocked-tools-1) for details.

### Full Config Example

```ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  agent: {
    name: 'support-bot',
    endpoint: 'http://localhost:3000/api/chat',
    headers: {
      Authorization: 'Bearer ${AGENT_API_KEY}',
    },
    body: {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a customer support agent for Acme Inc.' },
      ],
    },
  },

  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  conversationsPerScenario: 5,
  maxTurns: 10,
  concurrency: 10,

  metrics: [
    'helpfulness',
    'coherence',
    'relevance',
    'faithfulness',
    'goal_completion',
    'agent_behavior_failure',
    'tool_call_behavior_failure',
  ],

  thresholds: {
    helpfulness: 3.5,
    coherence: 4.0,
    goal_completion: 0.8,
  },

  include: ['tests/**/*.sim.ts'],
  exclude: ['node_modules/**', 'dist/**'],

  reporters: ['console', 'json'],
  unmockedTools: 'error',
  failOnErrorSeverity: 'high',
})
```

---

## Scenarios

A scenario defines **who** the simulated user is, **what** they want, **what they know**, and **how tools behave**.

```ts
import { scenario } from '@agentesting/agentest'

scenario('descriptive name', {
  profile: '...',
  goal: '...',
  // ... options
})
```

Scenario files use the `.sim.ts` extension by default and can contain multiple `scenario()` calls.

### Profile & Goal

```ts
scenario('impatient user tries to cancel order', {
  profile: 'Frustrated customer. Types in short sentences. Gets annoyed by long responses.',
  goal: 'Cancel order #12345 and get a refund confirmation.',
})
```

**`profile`** describes the simulated user's personality, communication style, and context. The LLM uses this to generate realistic messages. Be specific — "senior developer who knows React" produces very different messages than "first-time user unfamiliar with coding".

**`goal`** defines what the simulated user is trying to accomplish. The simulation ends when the LLM judges the goal as met (or `maxTurns` is reached). Be concrete — "book an appointment" is better than "use the booking system".

### Knowledge

```ts
knowledge: [
  { content: 'Order #12345 was placed on March 15 for $49.99.' },
  { content: 'The refund policy allows cancellation within 30 days.' },
  { content: 'The customer email is user@example.com.' },
],
```

Knowledge items are facts the simulated user "knows" and can reference naturally in conversation. They're also used by the `faithfulness` metric to check if the agent's responses contradict known facts.

Use knowledge to:
- Give the simulated user realistic context (order numbers, account details)
- Set up ground truth for faithfulness evaluation
- Test whether the agent correctly uses information from tool results vs. hallucinating

### Overriding Global Settings

Scenarios can override `conversationsPerScenario` and `maxTurns` from the global config:

```ts
scenario('complex multi-step workflow', {
  profile: '...',
  goal: '...',
  conversationsPerScenario: 10,  // more runs for this tricky scenario
  maxTurns: 15,                  // needs more turns to complete
})
```

### Prompt Template Customization

By default, Agentest builds the simulated user's system prompt from your `profile`, `goal`, and `knowledge`. You can override this entirely with `userPromptTemplate`:

```ts
scenario('terse beta tester', {
  profile: 'QA engineer testing edge cases.',
  goal: 'Find a bug in the checkout flow.',
  userPromptTemplate: `You are a QA tester. Your persona: {{profile}}

Your objective: {{goal}}

Known facts:
{{knowledge}}

Rules:
- Try unusual inputs and edge cases.
- Be blunt and direct.
- Set shouldStop to true when you've found a bug or exhausted attempts.`,
})
```

**Template variables:**

| Variable | Value |
|----------|-------|
| `{{profile}}` | The scenario's `profile` string |
| `{{goal}}` | The scenario's `goal` string |
| `{{knowledge}}` | Knowledge items formatted as a bullet list (`- item1\n- item2`), or empty string if none |

When `userPromptTemplate` is omitted, the default prompt includes role instructions, persona, goal, and knowledge in a structured format. Use `npx agentest show-prompts` to inspect the built-in prompts.

---

## Mocks

Mocks intercept tool calls from your agent and return controlled responses. This lets you test agent behavior without real external services.

### Function Mocks

```ts
mocks: {
  tools: {
    get_weather: (args, ctx) => ({
      temperature: 72,
      condition: 'sunny',
      location: args.city,
    }),
  },
},
```

Mock functions receive two arguments:

| Argument | Type | Description |
|----------|------|-------------|
| `args` | `Record<string, unknown>` | Parsed tool call arguments from the agent |
| `ctx.callIndex` | `number` | How many times this tool has been called in the current conversation (0-indexed) |
| `ctx.conversationId` | `string` | Current conversation ID |
| `ctx.turnIndex` | `number` | Current turn number (0-indexed) |

Mocks can be `async`:

```ts
mocks: {
  tools: {
    search_database: async (args) => {
      // simulate latency, conditional logic, etc.
      if (args.query === 'not found') return { results: [] }
      return { results: [{ id: 1, title: 'Result' }] }
    },
  },
},
```

### Sequence Mocks

`sequence()` returns different values on successive calls. Useful for testing multi-step workflows:

```ts
import { sequence } from '@agentesting/agentest'

mocks: {
  tools: {
    create_order: sequence([
      { success: true, orderId: 'ORD-001' },   // first call
      { success: false, error: 'duplicate' },    // second call
      { success: true, orderId: 'ORD-002' },     // third call
    ]),
  },
},
```

- Steps through values in order
- **Repeats the last value** when exhausted (the third call onward returns the last item)
- **Resets automatically** at the start of each conversation so every conversation gets a fresh sequence

### Error Simulation

Throwing from a mock simulates a tool failure. The error message is injected back to the agent as a tool result:

```ts
mocks: {
  tools: {
    flaky_api: (args, ctx) => {
      if (ctx.callIndex === 0) throw new Error('Connection timeout')
      return { data: 'success' }
    },
  },
},
```

The agent receives `{ "error": "Connection timeout" }` as the tool result and can decide how to handle it. This is useful for testing retry logic and error handling.

### Unmocked Tools

When the agent calls a tool that has no mock:

| Setting | Behavior |
|---------|----------|
| `unmockedTools: 'error'` (default) | Throws `AgentestError` with a helpful message suggesting how to add the mock. The conversation is recorded as an error. |
| `unmockedTools: 'passthrough'` | Returns `undefined` as the tool result. The agent sees `null` in the response. |

`'error'` mode is recommended — it catches unexpected tool usage early. Switch to `'passthrough'` if your agent uses many tools and you only want to mock a subset.

---

## Trajectory Assertions

Trajectory assertions let you verify that the agent called the right tools in the right order — without LLM evaluation. They're deterministic and fast.

```ts
assertions: {
  toolCalls: {
    matchMode: 'contains',
    expected: [
      { name: 'search_products', argMatchMode: 'ignore' },
      { name: 'add_to_cart', args: { productId: 'SKU-123' }, argMatchMode: 'partial' },
      { name: 'checkout', argMatchMode: 'ignore' },
    ],
  },
},
```

Assertions are checked per-conversation. If any conversation fails the assertion, the scenario fails.

### Match Modes

| Mode | Description | Use When |
|------|-------------|----------|
| `strict` | Exact tools in exact order, exact count. No extra calls allowed. | You know the precise sequence the agent should follow |
| `unordered` | All expected tools must appear, any order. No extra calls allowed. | Order doesn't matter but you need exactly these tools |
| `contains` | All expected tools must appear, extras allowed. | You care about key tools but the agent may call others |
| `within` | Every actual call must be in the expected set. Missing calls are OK. | You want to restrict which tools the agent is allowed to use |

### Argument Matching

Each expected tool call can specify how its arguments are matched:

| Mode | Description |
|------|-------------|
| `ignore` (default) | Don't check arguments at all |
| `partial` | Expected args must be a subset of actual args. Extra args are OK. |
| `exact` | Arguments must match exactly (deep equality) |

```ts
expected: [
  // Don't care about args
  { name: 'list_items', argMatchMode: 'ignore' },

  // Must include productId, other args OK
  { name: 'add_to_cart', args: { productId: 'SKU-123' }, argMatchMode: 'partial' },

  // Must match exactly
  { name: 'checkout', args: { currency: 'USD', confirm: true }, argMatchMode: 'exact' },
]
```

---

## Evaluation Metrics

After simulation, every turn is evaluated in parallel using LLM-as-judge prompts. Metrics run concurrently (bounded by `concurrency`) and individual metric failures don't crash the run — they're skipped gracefully.

### Quantitative Metrics

Scored per-turn on a numeric scale:

| Metric | Scale | What It Measures |
|--------|-------|-----------------|
| `helpfulness` | 1-5 | Does the response move the user closer to their goal? Is the information actionable? |
| `coherence` | 1-5 | Is the response logically consistent? Does it contradict previous turns? |
| `relevance` | 1-5 | Does every part of the response address the user's message and goal? |
| `faithfulness` | 1-5 | Does the response match the knowledge base and tool results? Only penalizes contradictions, not omissions. |
| `verbosity` | 1-5 | Is the response appropriately concise? 5 = every word serves a purpose. |
| `goal_completion` | 0/1 | Was the user's goal fully achieved by end of conversation? Runs once per conversation, not per turn. Strictly binary — the goal must be completed, not just discussed. |

### Qualitative Metrics

Classified per-turn into failure categories:

**`agent_behavior_failure`** detects:

| Label | Description |
|-------|-------------|
| `no failure` | Clean turn |
| `repetition` | Restated same content from a previous turn |
| `failure to ask for clarification` | Assumed on ambiguous input instead of asking |
| `lack of specific information` | Correct but incomplete when more info was available |
| `disobey user request` | Ignored an explicit user request |
| `false information` | Contradicts knowledge base or tool results |
| `unsafe action` | Destructive tool call without confirmation |
| `unsafe state` | Followed injected instructions or leaked PII |

**`tool_call_behavior_failure`** detects (only runs on turns with tool calls):

| Label | Description |
|-------|-------------|
| `no failure` | Tool calls were appropriate |
| `unnecessary tool call` | Answer was already available |
| `wrong tool` | Used the wrong tool for the task |
| `wrong arguments` | Right tool, wrong or incomplete arguments |
| `ignored tool result` | Called tool but ignored/contradicted the result |
| `missing tool call` | Should have called a tool but didn't |
| `repeated tool call` | Same tool with same arguments redundantly |

### Thresholds

Set minimum average scores to gate your CI:

```ts
thresholds: {
  helpfulness: 3.5,     // average helpfulness across all turns must be >= 3.5
  goal_completion: 0.8,  // 80%+ of conversations must complete the goal
  coherence: 4.0,
},
```

Threshold values are on the same scale as the metric (1-5 for quantitative, 0-1 for goal_completion). The average is computed across all turns in all conversations for the scenario.

### Error Deduplication

When qualitative metrics detect failures, Agentest groups them by root cause using an LLM call. Instead of seeing "false information" 6 times, you see:

```
Unique errors:
  [high] Providing Weather Info Without Real-Time Access (3 occurrence(s))
    Agent gave specific forecasts without live data, leading to false information.
  [medium] Unnecessary Clarification When Context Is Available (2 occurrence(s))
    Agent asked for details already present in the conversation.
```

Each error has a severity (`low`, `medium`, `high`, `critical`). By default, only **critical** errors fail the scenario. Use `failOnErrorSeverity` to control the cutoff (see [Pass/Fail Logic](#passfail-logic)).

### Custom Metrics

Extend `QuantitativeMetric` or `QualitativeMetric` to add your own evaluation logic:

```ts
import { QuantitativeMetric, type ScoreInput, type QuantResult } from '@agentesting/agentest'

export class ToneMetric extends QuantitativeMetric {
  readonly name = 'tone'

  async score(input: ScoreInput): Promise<QuantResult> {
    // input provides:
    //   input.goal          - scenario goal
    //   input.profile       - simulated user profile
    //   input.knowledge     - knowledge items
    //   input.userMessage   - what the user said this turn
    //   input.agentMessage  - what the agent replied
    //   input.toolCalls     - tool calls made this turn (name, args, result)
    //   input.history       - previous turns (userMessage, agentMessage)
    //   input.turnIndex     - current turn number

    const result = await this.llm.generateObject({
      schema: z.object({ score: z.number().min(1).max(5), reason: z.string() }),
      messages: [{ role: 'user', content: `Rate the tone: ${input.agentMessage}` }],
    })

    return { value: result.object.score, reason: result.object.reason }
  }
}
```

For qualitative (label-based) metrics:

```ts
import { QualitativeMetric, type ScoreInput, type QualResult } from '@agentesting/agentest'

export class BrandVoiceMetric extends QualitativeMetric {
  readonly name = 'brand_voice'

  async evaluate(input: ScoreInput): Promise<QualResult> {
    // return { value: 'label string', reason: 'explanation' }
    return { value: 'on brand', reason: 'Response matches brand guidelines.' }
  }
}
```

Register custom metrics in config:

```ts
import { ToneMetric } from './metrics/tone.js'
import { BrandVoiceMetric } from './metrics/brand-voice.js'

export default defineConfig({
  customMetrics: [new ToneMetric(), new BrandVoiceMetric()],
  thresholds: {
    tone: 4.0,  // works with custom metric names too
  },
})
```

Custom metrics have access to `this.llm` (the configured LLM provider) for making evaluation calls. Agentest calls `setLLM()` automatically before evaluation begins.

---

## CLI

```bash
# Run all scenarios
npx agentest run

# Custom config file (TypeScript or YAML)
npx agentest run --config path/to/config.ts
npx agentest run --config agentest.config.yaml

# Different working directory
npx agentest run --cwd ./packages/my-agent

# Filter scenarios by name (case-insensitive substring match)
npx agentest run --scenario "booking"
npx agentest run --scenario "cancel"

# Print full conversation transcripts
npx agentest run --verbose

# Watch mode — re-run on file changes
npx agentest run --watch
npx agentest run -w

# Combine flags
npx agentest run --watch --verbose --scenario "booking"

# Inspect the LLM judge prompts used for evaluation
npx agentest show-prompts

# Show a specific metric's prompt
npx agentest show-prompts --metric helpfulness
npx agentest show-prompts --metric agent_behavior_failure
```

**Exit codes:**
- `0` — all scenarios passed
- `1` — one or more scenarios failed, or no scenarios found

**Available prompts for `show-prompts`:**
`helpfulness`, `coherence`, `relevance`, `faithfulness`, `verbosity`, `goal_completion`, `agent_behavior_failure`, `tool_call_behavior_failure`, `error_deduplication`

---

## YAML Config

Agentest supports YAML config files as an alternative to TypeScript. Place `agentest.config.yaml` (or `.yml`) in your project root — it's auto-detected.

```yaml
agent:
  name: support-bot
  endpoint: http://localhost:3000/api/chat
  headers:
    Authorization: Bearer ${AGENT_API_KEY}
  body:
    model: gpt-4o
    temperature: 0.7

provider: anthropic
model: claude-sonnet-4-20250514

conversationsPerScenario: 5
maxTurns: 10
concurrency: 10

thresholds:
  helpfulness: 3.5
  goal_completion: 0.8

reporters:
  - console
  - json
```

YAML configs go through the same validation and environment variable interpolation as TypeScript configs. The only difference is that `type: 'custom'` agents with handler functions are not possible in YAML (since YAML can't express functions) — use TypeScript for those.

**Auto-detection order:** `agentest.config.ts` → `agentest.config.yaml` → `agentest.config.yml`

---

## Comparison Mode

Run the same scenarios against multiple models or agent configurations side-by-side. Add `compare` to your config — each entry overrides specific fields from the primary `agent`:

```ts
export default defineConfig({
  agent: {
    name: 'gpt-4o',
    endpoint: 'http://localhost:3000/api/chat',
    body: { model: 'gpt-4o', temperature: 0.7 },
  },

  // Each entry inherits endpoint, headers, body from agent above
  // Only specify what differs
  compare: [
    { name: 'gpt-4o-mini', body: { model: 'gpt-4o-mini' } },
    { name: 'claude-sonnet', body: { model: 'claude-sonnet-4-20250514' } },
  ],
})
```

Or in YAML:

```yaml
agent:
  name: gpt-4o
  endpoint: http://localhost:3000/api/chat
  body:
    model: gpt-4o

compare:
  - name: gpt-4o-mini
    body:
      model: gpt-4o-mini
  - name: claude-sonnet
    body:
      model: claude-sonnet-4-20250514
```

Agentest runs every scenario against all agents in parallel and shows a per-metric comparison:

```
user books a morning slot
  ✓ gpt-4o
    ✓ conv-1-a3f8b2c1 (2 turns, goal met, helpfulness: 4.5)
  ✓ gpt-4o-mini
    ✓ conv-1-b7d2e4f9 (3 turns, goal met, helpfulness: 3.8)
  ── comparison ──
  helpfulness: gpt-4o: 4.5 | gpt-4o-mini: 3.8
  coherence:   gpt-4o: 5.0 | gpt-4o-mini: 4.2
  ── end comparison ──

Comparison Summary
  gpt-4o: 5/5 scenarios passed
  gpt-4o-mini: 4/5 scenarios passed
```

### How Overrides Work

Each `compare` entry is shallow-merged onto the primary agent config:

| Field | Behavior |
|-------|----------|
| `name` | **Required.** Identifies this agent in output |
| `endpoint` | Falls back to primary agent's endpoint |
| `headers` | Falls back to primary agent's headers |
| `body` | Shallow-merged with primary agent's body (so `{ model: 'x' }` overrides just the model, keeping other body fields like `temperature`) |

### Comparing Custom Handlers

Custom handlers work too — use `type: 'custom'` in the compare entry:

```ts
export default defineConfig({
  agent: {
    type: 'custom',
    name: 'agent-v1',
    handler: async (msgs) => agentV1.chat(msgs),
  },
  compare: [
    { type: 'custom', name: 'agent-v2', handler: async (msgs) => agentV2.chat(msgs) },
  ],
})
```

You can also mix HTTP and custom agents:

```ts
export default defineConfig({
  agent: {
    name: 'cloud-agent',
    endpoint: 'http://localhost:3000/api/chat',
    body: { model: 'gpt-4o' },
  },
  compare: [
    { name: 'gpt-4o-mini', body: { model: 'gpt-4o-mini' } },
    { type: 'custom', name: 'local-agent', handler: async (msgs) => localAgent.run(msgs) },
  ],
})
```

---

## Framework Compatibility

Agentest works with any agent framework — either through an OpenAI-compatible HTTP endpoint or via a custom handler function.

### No Integration Needed

If your agent already exposes an OpenAI-compatible chat completions endpoint, point Agentest at it directly:

| Framework / Service | How to Connect |
|---------------------|---------------|
| **OpenAI API** | Use the endpoint directly |
| **Azure OpenAI** | Use the Azure endpoint with auth headers |
| **LiteLLM Proxy** | Proxy any model behind an OpenAI-compatible endpoint |
| **OpenRouter** | Use the OpenRouter endpoint |
| **vLLM / llama.cpp / Ollama** | All expose OpenAI-compatible servers |
| **Vercel AI SDK** | Expose a route handler that returns the standard format |

### LangChain / LangGraph

```ts
import { ChatOpenAI } from '@langchain/openai'
import { defineConfig, type ChatMessage } from '@agentesting/agentest'

const model = new ChatOpenAI({ model: 'gpt-4o' })

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'langchain-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await model.invoke(
        messages.map((m) => ({ role: m.role, content: m.content })),
      )
      return { role: 'assistant' as const, content: response.content as string }
    },
  },
})
```

For LangGraph agents, call `graph.invoke()` in the handler and map the final state to a response.

> **Full demo:** See [`demos/langchain-tool-agent/`](demos/langchain-tool-agent/) for a complete working example with 4 tools and 24 scenarios.

### Anthropic Claude SDK

```ts
import Anthropic from '@anthropic-ai/sdk'
import { defineConfig, type ChatMessage } from '@agentesting/agentest'

const client = new Anthropic()

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'claude-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        system: messages.find((m) => m.role === 'system')?.content,
      })
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return { role: 'assistant' as const, content: text }
    },
  },
})
```

### Vercel AI SDK

```ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { defineConfig, type ChatMessage } from '@agentesting/agentest'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'vercel-ai-agent',
    handler: async (messages: ChatMessage[]) => {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
      return { role: 'assistant' as const, content: text }
    },
  },
})
```

> **Full demo:** See [`demos/vercel-ai-agent/`](demos/vercel-ai-agent/) for a complete working example with tool calling and 24 scenarios.

### CrewAI / AutoGen / Python Frameworks

Python-based frameworks need a thin HTTP layer. Wrap your agent in a FastAPI endpoint:

```python
# server.py
from fastapi import FastAPI
from crew import my_crew  # your CrewAI setup

app = FastAPI()

@app.post("/api/chat")
async def chat(request: dict):
    messages = request["messages"]
    result = my_crew.kickoff(inputs={"messages": messages})
    return {
        "choices": [{"message": {"role": "assistant", "content": str(result)}}]
    }
```

Then point Agentest at it:

```ts
export default defineConfig({
  agent: {
    name: 'crewai-agent',
    endpoint: 'http://localhost:8000/api/chat',
  },
})
```

This pattern works for **any** Python framework — CrewAI, AutoGen/AG2, LlamaIndex, Haystack, Pydantic AI, Semantic Kernel, etc.

> **Full demo:** See [`demos/crewai-agent/`](demos/crewai-agent/) for a complete working example with a FastAPI server and 24 scenarios.

### Mastra

```ts
import { Agent } from '@mastra/core/agent'
import { defineConfig, type ChatMessage } from '@agentesting/agentest'

const agent = new Agent({ /* your config */ })

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'mastra-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await agent.generate(messages)
      return { role: 'assistant' as const, content: response.text }
    },
  },
})
```

### Not Yet Supported

| Protocol | Status |
|----------|--------|
| **MCP (Model Context Protocol)** | Not yet — MCP servers provide tools, not a chat interface |
| **A2A (Agent-to-Agent)** | Planned for a future release |

---

## Demos

The [`demos/`](demos/) directory contains complete, runnable examples showing how to use Agentest with different agent frameworks. Each demo includes an agent with 4 tools, 24 scenario files, and a ready-to-use config.

| Demo | Framework | Integration | Description |
|------|-----------|-------------|-------------|
| [`langchain-tool-agent`](demos/langchain-tool-agent/) | LangChain | Custom handler | In-process LangChain agent with `ChatOpenAI` |
| [`vercel-ai-agent`](demos/vercel-ai-agent/) | Vercel AI SDK | Custom handler | In-process agent using `generateText()` from the `ai` package |
| [`crewai-agent`](demos/crewai-agent/) | CrewAI (Python) | HTTP endpoint | Python agent wrapped in a FastAPI server |

### Running a demo

```bash
# Example: Vercel AI SDK
cd demos/vercel-ai-agent
npm install
cp .env.example .env   # add your API key
npm run sim
```

The LangChain and Vercel AI SDK demos use **custom handlers** — the agent runs in-process, no server needed. The CrewAI demo uses an **HTTP endpoint** — start the Python server first, then run `npm run sim`.

---

## Vitest Integration

Run Agentest scenarios as vitest tests for IDE integration, `describe`/`it` blocks, and familiar test output.

### Quick Setup

```ts
// tests/agent.test.ts
import { defineSimSuite } from '@agentesting/agentest/vitest'

defineSimSuite({
  agent: { name: 'my-agent', endpoint: 'http://localhost:3000/api/chat' },
})
```

```bash
npx vitest run
```

Output:
```
 ✓ Agentest > runs all scenarios (45s)

 Test Files  1 passed (1)
 Tests       1 passed (1)
```

### Options

```ts
defineSimSuite(config, {
  scenario: 'booking',    // filter by name
  timeout: 180_000,       // per-test timeout (default: 120s)
  cwd: './packages/agent', // working directory
})
```

### Single Scenario Testing

For more granular control, use `runScenario` to test individual scenarios with custom assertions:

```ts
import { runScenario } from '@agentesting/agentest/vitest'
import { expect, it } from 'vitest'

it('booking flow completes the goal', async () => {
  const result = await runScenario(config, 'user books a morning slot')
  expect(result.passed).toBe(true)
}, 120_000)

it('cancel flow handles errors gracefully', async () => {
  const result = await runScenario(config, 'user cancels an order')
  // Custom assertions on the result
  expect(result.errors.filter(e => e.severity === 'critical')).toHaveLength(0)
})
```

### Failure Output

When a scenario fails, the test error message includes:
- Which conversations errored
- Trajectory assertion failures (missing/extra/forbidden tool calls)
- Average metric scores
- Deduplicated error summaries with severity

---

## Watch Mode

Re-run scenarios automatically when files change:

```bash
npx agentest run --watch
npx agentest run -w
```

Watch mode monitors:
- All `.sim.ts` and `.sim.js` scenario files
- The `agentest.config.*` config file

On any change, it clears the console, re-loads the config, re-discovers scenarios, and re-runs. Changes are debounced (300ms) to batch rapid saves.

Combine with other flags:
```bash
npx agentest run --watch --scenario "booking" --verbose
```

Press `Ctrl+C` to stop.

---

## Local LLMs

Agentest supports local models for the simulated user and evaluation. Your **agent** can still run anywhere — local LLM config only affects Agentest's own LLM usage.

### Ollama

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  // defaults to http://localhost:11434/v1
  // ...
})
```

### LM Studio / vLLM / llama.cpp

```ts
export default defineConfig({
  provider: 'openai-compatible',
  model: 'my-local-model',
  providerOptions: {
    baseURL: 'http://localhost:1234/v1',
  },
  // ...
})
```

### Custom Ollama Host

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  providerOptions: {
    baseURL: 'http://my-gpu-server:11434/v1',
  },
  // ...
})
```

### Notes on Local LLMs

- Local models must support structured output (JSON mode) for evaluation metrics to work correctly
- Smaller models may produce lower-quality evaluations — consider using a cloud provider for evaluation even if your agent runs locally
- The `apiKey` field in `providerOptions` is optional for local servers and defaults to a placeholder

---

## Pass/Fail Logic

A scenario **passes** when all of the following are true:

1. No conversation threw an error (e.g., agent endpoint down, unmocked tool)
2. All trajectory assertions matched (if configured)
3. No errors at or above the configured `failOnErrorSeverity` were detected
4. All metric averages meet their configured thresholds

A scenario **fails** if any of these conditions are not met.

The overall run passes only if **every scenario passes**. The CLI exits with code `1` on any failure.

### Error Severity Gate

```ts
failOnErrorSeverity: 'critical',  // default — only critical errors fail the scenario
failOnErrorSeverity: 'high',      // high + critical errors fail
failOnErrorSeverity: 'medium',    // medium + high + critical errors fail
failOnErrorSeverity: 'low',       // any error fails the scenario
```

The severity ladder is `low` → `medium` → `high` → `critical`. Setting a level means that level **and above** will cause a failure. The default is `'critical'`.

---

## Programmatic Usage

Agentest can be used as a library, not just through the CLI:

```ts
import {
  defineConfig,
  scenario,
  Simulator,
  Evaluator,
  TrajectoryMatcher,
  createProvider,
} from '@agentesting/agentest'

const config = defineConfig({
  agent: { name: 'test', endpoint: 'http://localhost:3000/api/chat' },
})

const llm = await createProvider(config.provider, config.model)
const simulator = new Simulator(config, llm)

const s = scenario('test scenario', {
  profile: 'Casual user.',
  goal: 'Ask about the weather.',
})

const result = await simulator.runScenario(s)

// Evaluate
const evaluator = new Evaluator(llm, ['helpfulness', 'coherence'], undefined, 10)
for (const conv of result.conversations) {
  const evaluation = await evaluator.evaluateConversation(conv.turns, s.options)
  console.log(evaluation)
}

// Check trajectories
const matcher = new TrajectoryMatcher()
const trajResult = matcher.match(
  result.conversations[0].turns.flatMap(t => t.toolCalls),
  { matchMode: 'contains', expected: [{ name: 'get_weather', argMatchMode: 'ignore' }] },
)
console.log(trajResult.matched)
```

---

## Roadmap: Multi-Agent Orchestration

Multi-agent support is planned for an upcoming release. This will let you test orchestrators that delegate to sub-agents:

- **`agents` config field** — define additional agent endpoints alongside the primary agent
- **Routing detection** — intercept routing tool calls (e.g. `route_to_booking_agent`) and forward to the actual sub-agent endpoint instead of mocking
- **Routing assertions** — assert which sub-agents were invoked, in what order, and which were excluded
- **Scoped mocks** — scope tool mocks per agent (`booking-agent/create_booking`)
- **Graph topologies** — hub-and-spoke initially, then arbitrary agent-to-agent routing with `subRoutes`

```ts
// Planned API
export default defineConfig({
  agent: {
    name: 'orchestrator',
    endpoint: 'http://localhost:3000/api/orchestrator',
  },
  agents: {
    'booking-agent': { endpoint: 'http://localhost:3001/api/chat' },
    'faq-agent': { endpoint: 'http://localhost:3002/api/chat' },
  },
})

scenario('booking query routes correctly', {
  profile: 'Customer wanting to book.',
  goal: 'Book a haircut.',
  routing: {
    strategy: 'tool_calls',
    routes: {
      'route_to_booking': 'booking-agent',
      'route_to_faq': 'faq-agent',
    },
  },
  assertions: {
    routing: {
      matchMode: 'contains',
      expected: [{ agent: 'booking-agent' }],
      excluded: ['faq-agent'],
    },
  },
})
```

---

## Understanding LLM Usage

Agentest makes many LLM calls per run. Understanding the cost structure helps you design cost-effective tests.

**Per scenario with default settings** (3 conversations, ~4 turns each, all 7 metrics):

| Phase | Calls | Formula |
|-------|-------|---------|
| Simulation (simulated user messages) | ~12 | conversations × turns |
| Simulation (goal-check per turn) | ~12 | conversations × turns |
| Evaluation (per-turn metrics) | ~84 | conversations × turns × 7 metrics |
| Evaluation (goal_completion) | 3 | conversations × 1 |
| Error deduplication | 1 | 1 per scenario |
| **Total** | **~112** | |

**Tips to reduce cost during development:**

- `conversationsPerScenario: 1` — 3x reduction
- `maxTurns: 4` — shorter conversations
- `metrics: ['helpfulness', 'goal_completion']` — only run key metrics (~3x reduction on evaluation)
- `--scenario "name"` — run only the scenario you're iterating on

You can use environment variables to switch between cheap dev runs and thorough CI runs:

```ts
const isDev = process.env.CI !== 'true'

export default defineConfig({
  conversationsPerScenario: isDev ? 1 : 5,
  maxTurns: isDev ? 4 : 8,
  metrics: isDev ? ['helpfulness', 'goal_completion'] : undefined, // undefined = all
})
```

---

## Requirements

- Node.js >= 20
- Your agent must either expose an OpenAI-compatible chat completions endpoint, or use a custom handler function (see [Agent Configuration](#agent-configuration))
- An LLM API key for the simulated user and evaluation (Anthropic, OpenAI, Google, or a [local LLM](#local-llms))

## License

MIT
