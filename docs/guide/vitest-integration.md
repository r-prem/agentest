# Vitest Integration

Run Agentest scenarios as Vitest tests.

## Setup

```ts
// tests/agent.test.ts
import { defineSimSuite } from 'agentest/vitest'

defineSimSuite({
  agent: { name: 'my-agent', endpoint: 'http://localhost:3000/api/chat' },
})
```

Run with Vitest:

```bash
npx vitest run
```

## Options

```ts
defineSimSuite(config, {
  scenario: 'booking',         // filter by name
  timeout: 180_000,            // per-test timeout (default: 120s)
  cwd: './packages/agent',     // working directory
})
```

## Single Scenario Testing

```ts
import { runScenario } from 'agentest/vitest'
import { expect, it } from 'vitest'

it('booking flow completes the goal', async () => {
  const result = await runScenario(config, 'user books a morning slot')
  expect(result.passed).toBe(true)
}, 120_000)
```

## Output

```
✓ Agentest > runs all scenarios (45s)

Test Files  1 passed (1)
Tests       1 passed (1)
```
