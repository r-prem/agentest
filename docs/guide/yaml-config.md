# YAML Configuration

Agentest supports YAML configuration files as an alternative to TypeScript. This is useful for simpler configurations or when you don't need programmatic features like custom handler functions.

## File Discovery

Agentest auto-detects configuration files in this order:

1. `agentest.config.ts`
2. `agentest.config.yaml`
3. `agentest.config.yml`

Place your YAML config in the project root with one of these names, and Agentest will automatically find it.

## Basic YAML Config

```yaml
# agentest.config.yaml
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

## Environment Variable Interpolation

Just like TypeScript configs, YAML configs support `${VAR}` syntax for environment variable interpolation:

```yaml
agent:
  endpoint: https://api.example.com/chat
  headers:
    Authorization: Bearer ${AGENT_API_KEY}
    X-Custom-Header: ${CUSTOM_VALUE}
```

**Important:** If a referenced environment variable is not set, config loading will fail with a clear error message. This prevents accidentally running tests with missing credentials.

## Complete Example

```yaml
# Full configuration example
agent:
  name: booking-agent
  type: chat_completions  # default
  endpoint: http://localhost:3000/api/chat
  streaming: false
  headers:
    Authorization: Bearer ${AGENT_API_KEY}
    Content-Type: application/json
  body:
    model: gpt-4o
    temperature: 0.7
    messages:
      - role: system
        content: You are a helpful booking assistant.

# LLM provider for simulated user and evaluation
provider: anthropic
model: claude-sonnet-4-20250514

# Simulation settings
conversationsPerScenario: 3
maxTurns: 8
concurrency: 20

# Evaluation
metrics:
  - helpfulness
  - coherence
  - relevance
  - faithfulness
  - goal_completion
  - agent_behavior_failure

thresholds:
  helpfulness: 3.5
  coherence: 4.0
  goal_completion: 0.8

failOnErrorSeverity: critical

# File discovery
include:
  - tests/**/*.sim.ts
  - scenarios/**/*.sim.ts
exclude:
  - node_modules/**
  - dist/**

# Reporters
reporters:
  - console
  - json
  - github-actions

# Mock behavior
unmockedTools: error
```

## Comparison Mode in YAML

You can define comparison agents in YAML:

```yaml
agent:
  name: gpt-4o
  endpoint: http://localhost:3000/api/chat
  body:
    model: gpt-4o
    temperature: 0.7

compare:
  - name: gpt-4o-mini
    body:
      model: gpt-4o-mini

  - name: claude-sonnet
    body:
      model: claude-sonnet-4-20250514
    headers:
      Authorization: Bearer ${CLAUDE_API_KEY}

  - name: local-model
    endpoint: http://localhost:8080/v1/chat/completions
    body:
      model: llama-3.2
```

Each entry in `compare` inherits settings from the primary `agent` config and overrides only the specified fields.

## Local LLM Configuration

```yaml
# Ollama
provider: ollama
model: llama3.2
# defaults to http://localhost:11434/v1

# LM Studio / vLLM / llama.cpp
provider: openai-compatible
model: my-local-model
providerOptions:
  baseURL: http://localhost:1234/v1
  apiKey: not-needed  # optional for local servers

# Custom Ollama host
provider: ollama
model: llama3.2
providerOptions:
  baseURL: http://my-gpu-server:11434/v1
```

## Limitations

YAML configs have one limitation compared to TypeScript:

**Cannot use custom handler functions** — The `type: 'custom'` agent configuration requires a JavaScript/TypeScript function, which cannot be expressed in YAML.

For custom handlers, use a TypeScript config:

```ts
// agentest.config.ts
import { defineConfig } from 'agentest'
import { myAgent } from './src/agent.js'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'my-agent',
    handler: async (messages) => {
      const result = await myAgent.chat(messages)
      return { role: 'assistant', content: result.text }
    },
  },
})
```

## Using Custom Config Path

Override auto-detection with `--config`:

```bash
npx agentest run --config custom-config.yaml
npx agentest run --config configs/ci.yaml
npx agentest run --config agentest.prod.yml
```

## Validation

YAML configs go through the same Zod schema validation as TypeScript configs. If there's a validation error, you'll get a clear error message:

```
Error: Invalid configuration
  - agent.endpoint must be a valid URL
  - thresholds.helpfulness must be between 0 and 5
  - conversationsPerScenario must be a positive integer
```

## When to Use YAML vs TypeScript

**Use YAML when:**
- You have a simple configuration
- You don't need custom handlers
- You prefer declarative config files
- You're sharing config across different tools

**Use TypeScript when:**
- You need `type: 'custom'` agent handlers
- You want type safety and autocomplete in your editor
- You need to import custom metrics or other modules
- You prefer programmatic configuration

## Next Steps

- [Configuration API](/reference/config-api) - Full reference for all options
- [Getting Started](/guide/getting-started) - Initial setup guide
