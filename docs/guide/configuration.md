# Configuration

Complete guide to configuring Agentest.

## Configuration File

Create `agentest.config.ts` (or `agentest.config.yaml`) in your project root. Agentest auto-detects the format.

```ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  // Configuration options
})
```

The `defineConfig` helper provides:
- TypeScript type safety and autocomplete
- Zod schema validation
- Environment variable interpolation (`${VAR}` syntax)

For YAML configuration, see the [YAML Config Guide](/guide/yaml-config).

## Agent Configuration

Agentest supports two agent types: **chat completions** (HTTP endpoint) and **custom** (in-process handler function).

### Chat Completions (HTTP Endpoint)

The default agent type. Your agent must expose an OpenAI-compatible chat completions endpoint.

```ts
agent: {
  name: 'my-agent',
  type: 'chat_completions',  // default, can be omitted
  endpoint: 'http://localhost:3000/api/chat',

  // Optional: headers for authentication
  headers: {
    Authorization: 'Bearer ${AGENT_API_KEY}',  // interpolated from process.env
    'X-Custom-Header': 'value',
  },

  // Optional: merged into every request
  body: {
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
    ],
  },
}
```

#### Required Fields

- **`name`** (`string`) — Identifies your agent in test output
- **`endpoint`** (`string`) — HTTP/HTTPS URL for your agent's chat endpoint

#### Optional Fields

- **`type`** (`'chat_completions'`) — Default agent type (can be omitted)
- **`headers`** (`Record<string, string>`) — HTTP headers sent with every request
- **`body`** (`Record<string, any>`) — Shallow-merged into every request body
- **`streaming`** (`boolean`) — Enable Server-Sent Events (SSE) streaming mode

### Environment Variable Interpolation

Headers support `${VAR}` syntax for environment variables:

```ts
headers: {
  Authorization: 'Bearer ${AGENT_API_KEY}',
  'X-Org-ID': '${ORG_ID}',
}
```

**Important:** If a referenced variable is not set in `process.env`, config loading fails with a clear error. This keeps secrets out of your config files and prevents accidental runs with missing credentials.

Set environment variables in your shell or CI:

```bash
export AGENT_API_KEY=your-key-here
export ORG_ID=org-123
npx agentest run
```

### Request Body Merging

The `body` field is **shallow-merged** into every request:

```ts
agent: {
  endpoint: 'http://localhost:3000/api/chat',
  body: {
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
    ],
  },
}
```

Agentest sends:

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "User's first message" },
    ...
  ]
}
```

The `messages` array in `body` is **prepended** to conversation messages, which is useful for system prompts.

### Streaming Support

Enable Server-Sent Events (SSE) streaming mode when your agent endpoint streams responses by default:

```ts
agent: {
  name: 'streaming-agent',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  streaming: true,
  headers: {
    Authorization: 'Bearer ${OPENAI_API_KEY}',
  },
  body: {
    model: 'gpt-4o',
  },
}
```

When `streaming: true`:
1. Agentest sends `stream: true` in the request body
2. Parses the chunked SSE response
3. Accumulates `delta.content` and `delta.tool_calls` into a complete message
4. Returns the full message to the simulation loop

This works with any endpoint that follows OpenAI's streaming format:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" world"}}]}
data: [DONE]
```

### Custom Handler (In-Process)

Use `type: 'custom'` to connect any agent that doesn't have an OpenAI-compatible HTTP endpoint:

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

        // Optional: return tool calls if your agent uses tools
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location":"Seattle"}',
            },
          },
        ],
      }
    },
  },
})
```

#### Handler Signature

```ts
type AgentHandler = (messages: ChatMessage[]) => Promise<ChatMessage>

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]  // if role is 'assistant'
  tool_call_id?: string    // if role is 'tool'
}
```

The handler:
- Receives the full message history (same format used internally)
- Must return an assistant message
- If the response includes `tool_calls`, Agentest runs them through mocks and calls your handler again with the tool results

#### When to Use Custom Handlers

- **Non-OpenAI APIs** — Anthropic, Google, custom protocols
- **In-process agents** — No HTTP server needed
- **Framework SDKs** — LangChain, Vercel AI SDK, Mastra, etc.
- **Custom request/response mapping** — Your agent uses a different format

See [Framework Integration](/guide/framework-integration) for examples with LangChain, Vercel AI SDK, and more.

## LLM Provider

The LLM provider is used for the **simulated user** and **evaluation judges** — not for your agent.

### Cloud Providers

```ts
// Anthropic (default)
provider: 'anthropic',
model: 'claude-sonnet-4-20250514',

// OpenAI
provider: 'openai',
model: 'gpt-4o',

// Google
provider: 'google',
model: 'gemini-2.0-flash',
```

### Local Providers

```ts
// Ollama (defaults to http://localhost:11434/v1)
provider: 'ollama',
model: 'llama3.2',

// OpenAI-compatible (LM Studio, vLLM, llama.cpp)
provider: 'openai-compatible',
model: 'my-model',
providerOptions: {
  baseURL: 'http://localhost:1234/v1',  // required
  apiKey: 'optional-key',                // optional, defaults to 'not-needed'
},
```

### Environment Variables for API Keys

Cloud providers read API keys from standard environment variables:

```bash
export ANTHROPIC_API_KEY=your-key-here
export OPENAI_API_KEY=your-key-here
export GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

You don't need to configure these in Agentest — they're read automatically.

### Provider Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `string` | `'anthropic'` | `'anthropic'`, `'openai'`, `'google'`, `'ollama'`, `'openai-compatible'` |
| `model` | `string` | `'claude-sonnet-4-20250514'` | Model ID passed to the provider |
| `providerOptions.baseURL` | `string` | — | Base URL override. Required for `openai-compatible`, optional for `ollama` |
| `providerOptions.apiKey` | `string` | — | API key override. For local LLMs this is typically not needed |

See [Local LLMs](/guide/local-llms) for more details on running with local models.

## Simulation Parameters

Control how many conversations to run and how they're executed:

```ts
conversationsPerScenario: 3,  // run 3 independent conversations per scenario
maxTurns: 8,                  // max user↔agent exchanges per conversation
concurrency: 20,              // max parallel LLM calls across all scenarios
debounceMs: 0,                // optional delay (ms) between scenario starts
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `conversationsPerScenario` | `number` | `3` | How many independent conversations to run per scenario. More conversations = more statistical confidence, but more LLM cost. |
| `maxTurns` | `number` | `8` | Upper bound on user↔agent exchanges. The simulated user can stop earlier if the goal is met. |
| `concurrency` | `number` | `20` | Max parallel LLM calls. Controls both simulation and evaluation parallelism. Lower this if you're hitting rate limits. |
| `debounceMs` | `number` | `0` | Minimum delay in milliseconds between scenario starts. Useful for avoiding rate limits when running many scenarios. |

Both `conversationsPerScenario` and `maxTurns` can be overridden per-scenario:

```ts
scenario('complex workflow', {
  conversationsPerScenario: 10,  // needs more confidence
  maxTurns: 15,                  // needs more turns
  // ...
})
```

## Evaluation

Configure which metrics to run and their pass/fail thresholds:

```ts
// Run only specific metrics (default: all)
metrics: [
  'helpfulness',
  'coherence',
  'relevance',
  'faithfulness',
  'goal_completion',
  'agent_behavior_failure',
],

// Set minimum score thresholds (fail the run if average is below)
thresholds: {
  helpfulness: 3.5,      // average must be >= 3.5
  goal_completion: 0.7,  // 70%+ of conversations must complete goal
  coherence: 4.0,
},

// Minimum error severity that fails a scenario
failOnErrorSeverity: 'critical',  // 'low' | 'medium' | 'high' | 'critical'

// Custom metrics (advanced)
customMetrics: [new ToneMetric(), new BrandVoiceMetric()],
```

### Available Metrics

**Quantitative (1-5 scale):**
- `helpfulness` — How effectively the agent addresses user needs
- `coherence` — Logical flow and consistency
- `relevance` — How on-topic responses are
- `faithfulness` — No contradictions with knowledge or tool results
- `verbosity` — Appropriate response length

**Goal Completion (0/1):**
- `goal_completion` — Was the goal fully achieved?

**Qualitative (failure detection):**
- `agent_behavior_failure` — Detects repetition, false info, unsafe actions
- `tool_call_behavior_failure` — Wrong tools, missing calls, ignored results

### Evaluation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metrics` | `string[]` | all 8 metrics | Which evaluation metrics to run. Omit to run all. |
| `thresholds` | `Record<string, number>` | `{}` | Minimum average scores per metric. Values are 0-5 for quantitative, 0-1 for goal_completion. If any metric's average falls below its threshold, the run fails. |
| `failOnErrorSeverity` | `string` | `'critical'` | Minimum error severity that fails a scenario. One of `'low'`, `'medium'`, `'high'`, `'critical'`. |
| `customMetrics` | `Metric[]` | `[]` | Custom metric instances (see [Custom Metrics](/guide/custom-metrics)). |

See [Evaluation Metrics](/guide/evaluation-metrics) for detailed explanations of each metric.

## File Discovery

Configure which files to search for scenarios:

```ts
include: ['**/*.sim.ts'],      // glob patterns for scenario files
exclude: ['node_modules/**'],  // glob patterns to ignore
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string[]` | `['**/*.sim.ts']` | Glob patterns to find scenario files. Relative to the working directory. |
| `exclude` | `string[]` | `['node_modules/**']` | Glob patterns to exclude from discovery. |

Scenario files are TypeScript files that call `scenario()` when imported. Agentest uses [jiti](https://github.com/unjs/jiti) to import them directly — no build step needed.

## Reporters

Configure output formats:

```ts
reporters: ['console', 'json', 'github-actions'],
```

| Reporter | Description |
|----------|-------------|
| `console` | Colored pass/fail output with live progress spinner, metric scores, and error summaries. Default. In non-TTY environments (CI), falls back to line-by-line progress output. |
| `json` | Writes full results to `.agentest/results.json` including all turns, evaluations, and errors. Useful for programmatic analysis and custom reporting. |
| `github-actions` | Writes a markdown summary table to `$GITHUB_STEP_SUMMARY` and emits `::error`/`::warning`/`::notice` annotations that surface inline on PRs. |

See the [Reporters Guide](/guide/reporters) for detailed documentation.

## Mock Behavior

Control what happens when the agent calls a tool that has no mock defined:

```ts
unmockedTools: 'error',       // default: throw AgentestError
unmockedTools: 'passthrough', // return undefined (no-op)
```

| Setting | Behavior |
|---------|----------|
| `'error'` (default) | Throws `AgentestError` with a helpful message suggesting how to add the mock. The conversation is recorded as an error. |
| `'passthrough'` | Returns `undefined` as the tool result. The agent sees `null` in the response. |

`'error'` mode is recommended — it catches unexpected tool usage early. Switch to `'passthrough'` if your agent uses many tools and you only want to mock a subset.

See [Mocks Guide](/guide/mocks) for more details.

## Named Agents

For multi-agent architectures, you can define multiple named agents and target them from individual scenarios. This lets you test both high-level routing (supervisor) and low-level tool usage (domain agents) in the same test suite.

```ts
export default defineConfig({
  // Default agent — used when scenario doesn't specify one
  agent: {
    type: 'custom',
    name: 'supervisor',
    handler: supervisorHandler,
  },

  // Additional named agents
  agents: {
    billing: {
      type: 'custom',
      name: 'billing-agent',
      handler: billingHandler,
    },
    support: {
      type: 'custom',
      name: 'support-agent',
      handler: supportHandler,
    },
  },
})
```

Scenarios reference a named agent with the `agent` option:

```ts
// Uses the default agent (supervisor)
scenario('routes billing query correctly', {
  turns: [{ userMessage: 'What is the total for invoice INV-100?' }],
  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'get_invoice' }],
    },
  },
})

// Uses the named "support" agent directly
scenario('support agent creates a ticket', {
  agent: 'support',
  turns: [{ userMessage: 'I need help resetting my password' }],
  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'create_ticket', argMatchMode: 'ignore' },
        { name: 'send_reset_email', argMatchMode: 'ignore' },
      ],
    },
  },
  mocks: {
    tools: {
      create_ticket: () => ({ ticketId: 'TK-001' }),
      send_reset_email: () => ({ sent: true }),
    },
  },
})
```

### When to Use Named Agents

Named agents are ideal for **multi-agent architectures** where a supervisor routes to specialized sub-agents:

- **Supervisor scenarios** (default agent): Test routing — does the right domain agent get called with the right parameters?
- **Domain agent scenarios** (named agents): Test reasoning within a domain — does the agent call the right inner tools? Does it handle edge cases?

This separation keeps tests focused and fast. Supervisor tests mock domain agents as black boxes. Domain tests mock only the data-fetching tools underneath.

Named agents also work with HTTP endpoints — you can define different endpoints or headers per agent:

```ts
agents: {
  staging: {
    name: 'staging-api',
    endpoint: 'https://staging.example.com/api/chat',
    headers: { Authorization: 'Bearer ${STAGING_KEY}' },
  },
}
```

## Comparison Mode

Run the same scenarios against multiple models or agent configurations side-by-side:

```ts
export default defineConfig({
  agent: {
    name: 'gpt-4o',
    endpoint: 'http://localhost:3000/api/chat',
    body: { model: 'gpt-4o' },
  },

  // Each entry inherits endpoint, headers, body from agent above
  // Only specify what differs
  compare: [
    { name: 'gpt-4o-mini', body: { model: 'gpt-4o-mini' } },
    { name: 'claude-sonnet', body: { model: 'claude-sonnet-4-20250514' } },
  ],
})
```

See [Comparison Mode](/guide/comparison-mode) for examples and output.

## Full Config Example

```ts
import { defineConfig } from '@agentesting/agentest'
import { ToneMetric } from './metrics/tone.js'

export default defineConfig({
  // Agent configuration
  agent: {
    name: 'support-bot',
    endpoint: 'http://localhost:3000/api/chat',
    streaming: false,
    headers: {
      Authorization: 'Bearer ${AGENT_API_KEY}',
      'X-Org-ID': '${ORG_ID}',
    },
    body: {
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a customer support agent for Acme Inc.' },
      ],
    },
  },

  // LLM provider for simulation and evaluation
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  // Simulation settings
  conversationsPerScenario: 5,
  maxTurns: 10,
  concurrency: 10,

  // Evaluation
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

  failOnErrorSeverity: 'high',

  customMetrics: [new ToneMetric()],

  // File discovery
  include: ['tests/**/*.sim.ts'],
  exclude: ['node_modules/**', 'dist/**'],

  // Output
  reporters: ['console', 'json', 'github-actions'],

  // Mock behavior
  unmockedTools: 'error',
})
```

## Next Steps

- [Scenarios](/guide/scenarios) - Write test scenarios
- [Mocks](/guide/mocks) - Control tool behavior
- [Evaluation Metrics](/guide/evaluation-metrics) - Understand quality metrics
- [Configuration API](/reference/config-api) - Complete API reference
- [YAML Config](/guide/yaml-config) - Use YAML instead of TypeScript
