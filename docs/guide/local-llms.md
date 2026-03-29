# Local LLMs

Use local models for the simulated user and evaluation judges. Your **agent** can still run anywhere — local LLM config only affects Agentest's own LLM usage.

## What Gets Affected

The `provider` and `model` settings control two things:

1. **Simulated user** — the LLM that generates realistic user messages
2. **Evaluation judges** — the LLMs that score helpfulness, coherence, etc.

Your agent is **not affected**. It can be a cloud API, a local model, or a custom handler — that's configured separately in `agent.endpoint` or `agent.handler`.

```
              Agentest's LLM (local)
              ┌──────────────┐
              │ Simulated    │──→ Your Agent (anywhere)
              │ User         │←── Agent responds
              │              │
              │ Evaluation   │──→ Scores each turn
              │ Judges       │
              └──────────────┘
```

## Ollama

The simplest way to use a local model:

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  // defaults to http://localhost:11434/v1
})
```

Make sure Ollama is running (`ollama serve`) and the model is pulled (`ollama pull llama3.2`).

### Custom Ollama Host

Point to a remote GPU server:

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  providerOptions: {
    baseURL: 'http://my-gpu-server:11434/v1',
  },
})
```

## LM Studio / vLLM / llama.cpp

Any server that exposes an OpenAI-compatible API:

```ts
export default defineConfig({
  provider: 'openai-compatible',
  model: 'my-local-model',
  providerOptions: {
    baseURL: 'http://localhost:1234/v1',  // required
    apiKey: 'not-needed',                 // optional, defaults to placeholder
  },
})
```

### Provider-Specific Examples

**LM Studio:**
```ts
provider: 'openai-compatible',
model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
providerOptions: { baseURL: 'http://localhost:1234/v1' },
```

**vLLM:**
```ts
provider: 'openai-compatible',
model: 'meta-llama/Llama-3.1-8B-Instruct',
providerOptions: { baseURL: 'http://localhost:8000/v1' },
```

**llama.cpp server:**
```ts
provider: 'openai-compatible',
model: 'default',  // llama.cpp uses a single model
providerOptions: { baseURL: 'http://localhost:8080/v1' },
```

## Important Considerations

### Structured Output Support

Agentest's evaluation metrics use **structured output** (JSON mode) to extract scores and labels. Your local model must support this.

Models that work well:
- Llama 3.1 8B+ (with JSON mode)
- Mistral 7B+ (with function calling)
- Qwen 2.5 7B+

Models that may struggle:
- Very small models (< 7B parameters)
- Models without JSON/function calling support
- Older model architectures

If your local model can't produce reliable structured output, evaluation metrics will fail or return incorrect scores. You'll see errors like:

```
WARN: Metric 'helpfulness' failed for turn 2: Failed to parse structured output
```

### Evaluation Quality

Smaller models produce lower-quality evaluations. A 7B model judging "helpfulness" won't be as nuanced as Claude Sonnet or GPT-4o. Consider this tradeoff:

| Setup | Cost | Evaluation Quality |
|-------|------|--------------------|
| Cloud model for everything | $$$ | High |
| Local model for simulation, cloud for evaluation | $$ | High |
| Local model for everything | Free | Lower |

**Recommended for production CI:** Use a cloud provider for evaluation even if your agent runs locally. Evaluation quality directly affects whether your tests catch real issues.

**Good for development/iteration:** Local models for both simulation and evaluation. Fast feedback loop, zero cost.

### Hybrid Setup

Use a local model for the simulated user (cheap, frequent calls) and a cloud model for evaluation (fewer calls, quality matters):

This isn't natively supported in a single config, but you can work around it by running two passes:

```bash
# Quick local run during development
ANTHROPIC_API_KEY=not-needed npx agentest run  # with local config

# Full evaluation in CI
npx agentest run  # with cloud config
```

### Concurrency

Local models typically handle fewer concurrent requests than cloud APIs. Lower the `concurrency` setting:

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  concurrency: 2,  // instead of default 20
})
```

If you see timeout errors or degraded performance, reduce concurrency further.

### Model Warm-Up

The first request to a local model may be slow (loading weights into memory). Subsequent requests are faster. If your first scenario appears to hang, give it a minute — the model is loading.

## Next Steps

- [Configuration](/guide/configuration) — Full provider configuration reference
- [Troubleshooting](/guide/troubleshooting) — Common issues with local LLMs
- [Comparison Mode](/guide/comparison-mode) — Compare local vs cloud agents
