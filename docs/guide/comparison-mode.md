# Comparison Mode

Run scenarios against multiple models side-by-side.

## Basic Usage

```ts
export default defineConfig({
  agent: {
    name: 'gpt-4o',
    endpoint: 'http://localhost:3000/api/chat',
    body: { model: 'gpt-4o' },
  },

  compare: [
    { name: 'gpt-4o-mini', body: { model: 'gpt-4o-mini' } },
    { name: 'claude-sonnet', body: { model: 'claude-sonnet-4-20250514' } },
  ],
})
```

## Output

```
user books a morning slot
  ✓ gpt-4o
    ✓ conv-1 (2 turns, goal met, helpfulness: 4.5)
  ✓ gpt-4o-mini
    ✓ conv-1 (3 turns, goal met, helpfulness: 3.8)

  ── comparison ──
  helpfulness: gpt-4o: 4.5 | gpt-4o-mini: 3.8
  coherence:   gpt-4o: 5.0 | gpt-4o-mini: 4.2
```

## Custom Handlers

```ts
compare: [
  { type: 'custom', name: 'agent-v2', handler: async (msgs) => agentV2.chat(msgs) },
]
```
