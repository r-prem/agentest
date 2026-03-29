# Local LLMs

Use local models for simulation and evaluation.

## Ollama

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  // defaults to http://localhost:11434/v1
})
```

## LM Studio / vLLM / llama.cpp

```ts
export default defineConfig({
  provider: 'openai-compatible',
  model: 'my-local-model',
  providerOptions: {
    baseURL: 'http://localhost:1234/v1',
  },
})
```

## Custom Ollama Host

```ts
export default defineConfig({
  provider: 'ollama',
  model: 'llama3.2',
  providerOptions: {
    baseURL: 'http://my-gpu-server:11434/v1',
  },
})
```

## Important Notes

- Local models must support structured output (JSON mode) for evaluation metrics
- Smaller models may produce lower-quality evaluations
- Consider using cloud providers for evaluation even if your agent runs locally
- The `apiKey` field is optional for local servers

## Your Agent Can Still Be Cloud-Based

The `provider` and `model` settings only affect:
- The simulated user
- The evaluation judges

Your agent can still run anywhere (cloud, local, in-process).
