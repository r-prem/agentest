# Configuration API

Complete reference for `defineConfig()` and all configuration options.

## `defineConfig()`

```ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  // options
})
```

Validates configuration with Zod and interpolates environment variables.

## Agent Configuration

### `agent`

**Type:** `AgentConfig`

**Required**

Configure your agent endpoint or custom handler.

#### HTTP Agent (Chat Completions)

```ts
agent: {
  type: 'chat_completions',    // default
  name: string,                 // required
  endpoint: string,             // required
  headers?: Record<string, string>,
  body?: Record<string, any>,
  streaming?: boolean,
}
```

#### Custom Handler

```ts
agent: {
  type: 'custom',
  name: string,
  handler: (messages: ChatMessage[]) => Promise<ChatMessage>,
}
```

## LLM Provider

### `provider`

**Type:** `'anthropic' | 'openai' | 'google' | 'ollama' | 'openai-compatible'`

**Default:** `'anthropic'`

LLM provider for simulated user and evaluation.

### `model`

**Type:** `string`

**Default:** `'claude-sonnet-4-20250514'`

Model ID for the provider.

### `providerOptions`

**Type:** `{ baseURL?: string, apiKey?: string }`

**Optional**

Override base URL and API key (for local LLMs).

## Simulation

### `conversationsPerScenario`

**Type:** `number`

**Default:** `3`

Number of independent conversations per scenario.

### `maxTurns`

**Type:** `number`

**Default:** `8`

Maximum turns per conversation.

### `concurrency`

**Type:** `number`

**Default:** `20`

Max parallel LLM calls.

## Evaluation

### `metrics`

**Type:** `string[]`

**Default:** All metrics

Which metrics to run.

### `thresholds`

**Type:** `Record<string, number>`

**Default:** `{}`

Minimum average scores per metric.

### `failOnErrorSeverity`

**Type:** `'low' | 'medium' | 'high' | 'critical'`

**Default:** `'critical'`

Minimum error severity that fails a scenario.

### `customMetrics`

**Type:** `Metric[]`

**Default:** `[]`

Custom metric instances.

## File Discovery

### `include`

**Type:** `string[]`

**Default:** `['**/*.sim.ts']`

Glob patterns for scenario files.

### `exclude`

**Type:** `string[]`

**Default:** `['node_modules/**']`

Glob patterns to exclude.

## Reporters

### `reporters`

**Type:** `('console' | 'json' | 'github-actions')[]`

**Default:** `['console']`

Output reporters.

## Mock Behavior

### `unmockedTools`

**Type:** `'error' | 'passthrough'`

**Default:** `'error'`

Behavior for unmocked tools.

## Comparison Mode

### `compare`

**Type:** `AgentConfig[]`

**Optional**

Additional agent configurations for comparison.
