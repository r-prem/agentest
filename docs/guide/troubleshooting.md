# Troubleshooting

Common issues and how to fix them.

## Agent Endpoint Errors

### "Agent endpoint resolves to a private/internal address"

Agentest blocks requests to `localhost`, `127.0.0.1`, `169.254.169.254`, and other private/internal addresses by default. This is a safety measure to prevent accidental exposure of internal services.

```
Error: Agent endpoint "localhost" resolves to a private/internal address.
Set AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1 to override.
```

**Fix:** Set the environment variable before running:

```bash
AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1 npx agentest run
```

Or export it in your shell:

```bash
export AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1
npx agentest run
```

Or add it to a `.env` file (if your setup loads `.env` files).

This is the most common issue for new users since most development setups run the agent on `localhost`.

### "Agent endpoint returned 500" or "ECONNREFUSED"

Your agent isn't running or the endpoint URL is wrong.

```
✗ user books a morning slot
  ✗ conv-1 ERROR: Agent endpoint returned 500
```

**Fix:**
1. Make sure your agent is running (`curl http://localhost:3000/api/chat` to verify)
2. Check the `endpoint` in your config matches the actual URL
3. If using Docker, ensure the port is exposed and `localhost` resolves correctly (try `host.docker.internal` on macOS/Windows)

### "Agent returned invalid JSON"

Your endpoint returned HTML, plain text, or malformed JSON instead of the expected chat completions response.

**Fix:**
1. Test the endpoint directly: `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hello"}]}'`
2. Verify it returns `{ "choices": [{ "message": { "role": "assistant", "content": "..." } }] }`
3. Common cause: endpoint returns an error page (HTML) when auth fails

### "Request timeout"

The agent took too long to respond.

**Fix:**
- Check if the agent is overloaded or the model is slow
- For local LLMs, the first request can be slow while the model loads into memory — wait for it
- Lower `concurrency` to reduce load on the agent

## API Key Issues

### "401 Unauthorized" from agent endpoint

The `Authorization` header isn't set or the key is wrong.

**Fix:**
1. Check that the environment variable is set: `echo $AGENT_API_KEY`
2. Verify the `headers` config uses the right variable name: `Authorization: 'Bearer ${AGENT_API_KEY}'`
3. The `${VAR}` syntax reads from `process.env` — it's not a shell variable

### "API key not found" for simulation/evaluation LLM

Agentest can't find the API key for the simulated user and evaluation judge.

```
Error: ANTHROPIC_API_KEY is not set
```

**Fix:** Set the API key for your configured provider:

```bash
# Anthropic (default provider)
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# Google
export GOOGLE_GENERATIVE_AI_API_KEY=...
```

These are for Agentest's own LLM usage (simulated user + evaluation), not for your agent.

## Unmocked Tool Errors

### "Tool 'X' was called but no mock is defined"

Your agent called a tool that you didn't provide a mock for.

```
ERROR: Tool 'send_confirmation_email' was called but no mock is defined.
```

**Fix (option 1):** Add a mock for the tool:

```ts
mocks: {
  tools: {
    send_confirmation_email: (args) => ({
      success: true,
      messageId: 'msg-123',
    }),
  },
}
```

**Fix (option 2):** Allow unmocked tools to pass through:

```ts
// In agentest.config.ts
unmockedTools: 'passthrough',
```

**Tip:** This error is actually useful — it tells you the agent is calling tools you didn't expect. Run with `--verbose` to see what arguments the agent passed, then decide whether to mock or passthrough.

## Structured Output Failures

### "Failed to parse structured output"

The evaluation LLM returned invalid JSON for a metric score.

```
WARN: Metric 'helpfulness' failed for turn 2: Failed to parse structured output
```

**Common causes:**
- **Local LLM** doesn't support JSON mode or structured output reliably
- **Rate limiting** — the LLM API returned an error instead of a response
- **Model too small** — very small models (< 7B) struggle with structured output

**Fix:**
- Switch to a larger model or a cloud provider for evaluation
- Lower `concurrency` to avoid rate limits
- Check if your local model supports JSON mode (Ollama: look for `json` format support)

### Unreliable metric scores with local models

If scores seem random or all the same, the local model may not understand the evaluation prompt well enough.

**Fix:**
- Use a model with at least 8B parameters for evaluation
- Consider using a cloud provider for evaluation even if the agent runs locally
- Run `npx agentest show-prompts --metric helpfulness` to see the evaluation prompt — some models handle certain prompt styles better than others

## Scenario Discovery

### "No scenarios found"

Agentest didn't find any `.sim.ts` files.

```
No scenarios found matching include patterns
```

**Fix:**
1. Check your file naming — default pattern is `**/*.sim.ts`
2. Verify the `include` pattern in your config matches your file locations
3. Check `--cwd` if running from a different directory
4. Ensure scenario files actually call `scenario()` — a file that only exports functions won't be discovered

### Scenarios run but no tool calls are intercepted

Your agent isn't returning `tool_calls` in the response format Agentest expects.

**Fix:**
- Verify your agent returns tool calls in OpenAI format: `{ tool_calls: [{ id, type: 'function', function: { name, arguments } }] }`
- If using a custom handler, make sure you're mapping tool calls correctly (see [Framework Integration](/guide/framework-integration#tool-calls-with-custom-handlers))
- Check `--verbose` output to see the raw agent responses

## Rate Limiting

### "429 Too Many Requests"

You're hitting the LLM provider's rate limit.

**Fix:**
- Lower `concurrency` in your config (e.g., `concurrency: 5` instead of 20)
- Reduce `conversationsPerScenario` during development
- Use a provider with higher rate limits or request a limit increase

### Running costs are higher than expected

Each scenario generates many LLM calls. See [Understanding LLM Usage](/guide/writing-effective-scenarios#understanding-llm-usage) for a breakdown.

**Quick formula:**
```
LLM calls per scenario ≈
  conversations × turns × 2 (simulation)
  + conversations × turns × metrics (evaluation)
  + conversations (goal_completion)
  + 1 (error deduplication)
```

**Tips to reduce cost:**
- Use `conversationsPerScenario: 1` during development, increase for CI
- Run only specific metrics: `metrics: ['helpfulness', 'goal_completion']`
- Use `--scenario "name"` to run only the scenario you're iterating on
- Use a cheaper model for simulation (it needs to be conversational, not highly capable)

## Watch Mode Issues

### Watch mode doesn't detect changes

Watch mode monitors `.sim.ts`, `.sim.js`, and `agentest.config.*` files.

**Fix:**
- Make sure your scenario files use the `.sim.ts` extension
- Changes to other files (e.g., your agent code, mock helpers) won't trigger re-runs
- Check that `--watch` flag is present: `npx agentest run --watch`

## Vitest Integration

### "Test timeout" with vitest

The default vitest timeout (5 seconds) is too short for agent simulations.

**Fix:** Set explicit timeouts:

```ts
// Per-test
it('booking works', async () => {
  const result = await runScenario(config, 'booking')
  expect(result.passed).toBe(true)
}, 120_000)  // 120 seconds

// Or in defineSimSuite
defineSimSuite(config, { timeout: 180_000 })
```

### Scenarios pass in CLI but fail in vitest

Usually a timeout issue. Agent simulations can take 30-120 seconds depending on the number of turns and conversations. The CLI has no timeout; vitest has a default 5s timeout.

## Getting Help

### Debug with verbose mode

```bash
npx agentest run --verbose
```

Shows full conversation transcripts, tool calls with arguments and results, and per-turn metric scores. This is the single most useful debugging tool.

### Inspect evaluation prompts

```bash
npx agentest show-prompts
npx agentest show-prompts --metric helpfulness
```

If a metric is giving unexpected scores, reading the prompt can help you understand why.

### Check JSON output

```ts
reporters: ['console', 'json'],
```

The JSON report (`.agentest/results.json`) contains every turn, tool call, metric score, and error. Use it to build dashboards or dig into specific failures.

## Next Steps

- [Pass/Fail Logic](/guide/pass-fail-logic) — Understand why scenarios fail
- [CLI Reference](/reference/cli) — All CLI options
- [Configuration](/guide/configuration) — Tune settings
