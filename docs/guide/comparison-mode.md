# Comparison Mode

Run the same scenarios against multiple models or agent configurations side-by-side. Compare quality, tool usage, and goal completion across agents to make informed decisions about which model to deploy.

## When to Use Comparison Mode

- **Model selection** — evaluating GPT-4o vs Claude Sonnet vs Gemini for your use case
- **Prompt iteration** — testing different system prompts or temperatures
- **Regression testing** — comparing a new agent version against the current one
- **Cost optimization** — checking if a smaller/cheaper model performs well enough

## Basic Setup

Add a `compare` array to your config. Each entry overrides specific fields from the primary `agent`:

```ts
export default defineConfig({
  agent: {
    name: 'gpt-4o',
    endpoint: 'http://localhost:3000/api/chat',
    body: { model: 'gpt-4o', temperature: 0.7 },
  },

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
    temperature: 0.7

compare:
  - name: gpt-4o-mini
    body:
      model: gpt-4o-mini
  - name: claude-sonnet
    body:
      model: claude-sonnet-4-20250514
```

Agentest runs every scenario against **all agents** in parallel.

## How Overrides Work

Each `compare` entry is shallow-merged onto the primary agent config:

| Field | Behavior |
|-------|----------|
| `name` | **Required.** Identifies this agent in output |
| `endpoint` | Falls back to primary agent's endpoint |
| `headers` | Falls back to primary agent's headers |
| `body` | **Shallow-merged** with primary agent's body. `{ model: 'x' }` overrides just the model, keeping other body fields like `temperature` |
| `type` | Can switch between `chat_completions` and `custom` |
| `streaming` | Falls back to primary agent's streaming setting |

This means you typically only need to specify what's different:

```ts
// Primary agent has endpoint, headers, body.temperature already set.
// These entries inherit all of that — they only change the model.
compare: [
  { name: 'gpt-4o-mini', body: { model: 'gpt-4o-mini' } },
  { name: 'gpt-3.5', body: { model: 'gpt-3.5-turbo' } },
]
```

## Comparing Different Endpoints

Test agents running on different servers:

```ts
export default defineConfig({
  agent: {
    name: 'production',
    endpoint: 'https://api.example.com/chat',
    headers: { Authorization: 'Bearer ${PROD_KEY}' },
  },

  compare: [
    {
      name: 'staging',
      endpoint: 'https://staging-api.example.com/chat',
      headers: { Authorization: 'Bearer ${STAGING_KEY}' },
    },
  ],
})
```

## Comparing Custom Handlers

Use `type: 'custom'` in compare entries:

```ts
export default defineConfig({
  agent: {
    type: 'custom',
    name: 'agent-v1',
    handler: async (msgs) => agentV1.chat(msgs),
  },

  compare: [
    {
      type: 'custom',
      name: 'agent-v2',
      handler: async (msgs) => agentV2.chat(msgs),
    },
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
    {
      type: 'custom',
      name: 'local-agent',
      handler: async (msgs) => localAgent.run(msgs),
    },
  ],
})
```

## Comparing Temperatures and Prompts

Test different configurations of the same model:

```ts
export default defineConfig({
  agent: {
    name: 'conservative',
    endpoint: 'http://localhost:3000/api/chat',
    body: {
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [{ role: 'system', content: 'Be concise and factual.' }],
    },
  },

  compare: [
    {
      name: 'creative',
      body: {
        temperature: 0.9,
        messages: [{ role: 'system', content: 'Be creative and engaging.' }],
      },
    },
    {
      name: 'balanced',
      body: {
        temperature: 0.7,
        messages: [{ role: 'system', content: 'Balance helpfulness with brevity.' }],
      },
    },
  ],
})
```

## Output

Agentest shows per-metric comparison after each scenario:

```
user books a morning slot
  ✓ gpt-4o
    ✓ conv-1-a3f8b2c1 (2 turns, goal met, helpfulness: 4.5)
    ✓ conv-2-d9e1f4a7 (3 turns, goal met, helpfulness: 4.2)
  ✓ gpt-4o-mini
    ✓ conv-1-b7d2e4f9 (3 turns, goal met, helpfulness: 3.8)
    ✓ conv-2-c1a4b7e3 (4 turns, goal met, helpfulness: 3.5)

  ── comparison ──
  helpfulness: gpt-4o: 4.35 | gpt-4o-mini: 3.65
  coherence:   gpt-4o: 5.0  | gpt-4o-mini: 4.2
  goal_completion: gpt-4o: 1.0 | gpt-4o-mini: 1.0
  ── end comparison ──

Comparison Summary
  gpt-4o: 5/5 scenarios passed
  gpt-4o-mini: 4/5 scenarios passed
```

The JSON reporter includes full results for each agent, making it easy to build dashboards or track metrics over time.

## Thresholds in Comparison Mode

Thresholds apply independently to each agent. An agent fails a scenario if its metrics don't meet the thresholds — other agents' scores don't affect it:

```ts
thresholds: {
  helpfulness: 3.5,
  goal_completion: 0.8,
}

// gpt-4o: helpfulness 4.35 ✅, goal_completion 1.0 ✅ → PASS
// gpt-4o-mini: helpfulness 3.65 ✅, goal_completion 0.6 ❌ → FAIL
```

## Tips

- **Start with 2 agents**, then add more. Each agent multiplies the total LLM calls.
- **Use `--scenario` to compare on specific scenarios** rather than the full suite during iteration.
- **Lower `conversationsPerScenario`** during comparison (e.g., 2 instead of 5) to reduce cost while still getting useful signal.
- **Check the JSON output** for detailed per-turn comparisons — the console summary only shows averages.

## Next Steps

- [Configuration](/guide/configuration) — Full config reference
- [Reporters](/guide/reporters) — JSON output for detailed comparison data
- [CLI Reference](/reference/cli) — Filtering and verbose options
