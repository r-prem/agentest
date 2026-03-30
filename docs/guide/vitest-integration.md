# Vitest Integration

Run Agentest scenarios as vitest tests for IDE integration, `describe`/`it` blocks, and familiar test output.

## Why Use Vitest Integration?

- **IDE support** — run individual scenarios from your editor (VS Code, WebStorm)
- **Familiar output** — vitest's test reporter, `--watch`, `--reporter` flags
- **Custom assertions** — use `expect()` on scenario results for fine-grained checks
- **Unified test suite** — agent tests alongside unit tests in the same `vitest run`

## Quick Setup

### `defineSimSuite`

The simplest way to run all scenarios as a vitest test:

```ts
// tests/agent.test.ts
import { defineSimSuite } from 'agentest/vitest'

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

`defineSimSuite` discovers all `.sim.ts` files, runs them, and fails the vitest test if any scenario fails — using the same pass/fail logic as the CLI.

### Options

```ts
defineSimSuite(config, {
  scenario: 'booking',      // filter scenarios by name (substring match)
  timeout: 180_000,         // per-test timeout in ms (default: 120_000)
  cwd: './packages/agent',  // working directory for scenario discovery
})
```

**Timeout:** Agent simulations involve multiple LLM calls and can take 30-120 seconds per scenario. Set the timeout high enough to avoid false failures. The default is 120 seconds.

## Single Scenario Testing

For more granular control, use `runScenario` to test individual scenarios with custom assertions:

```ts
import { runScenario } from 'agentest/vitest'
import { defineConfig } from '@agentesting/agentest'
import { describe, it, expect } from 'vitest'

const config = defineConfig({
  agent: { name: 'my-agent', endpoint: 'http://localhost:3000/api/chat' },
})

describe('booking agent', () => {
  it('completes the booking goal', async () => {
    const result = await runScenario(config, 'user books a morning slot')
    expect(result.passed).toBe(true)
  }, 120_000)

  it('handles errors without critical failures', async () => {
    const result = await runScenario(config, 'user tries unavailable slot')
    const criticalErrors = result.errors.filter(e => e.severity === 'critical')
    expect(criticalErrors).toHaveLength(0)
  }, 120_000)

  it('achieves high helpfulness', async () => {
    const result = await runScenario(config, 'user books a morning slot')
    expect(result.avgScores.helpfulness).toBeGreaterThan(3.5)
  }, 120_000)
})
```

### What `runScenario` Returns

`runScenario` returns a `ScenarioSummary` with:

```ts
interface ScenarioSummary {
  passed: boolean
  totalConversations: number
  passedConversations: number
  failedConversations: number
  avgScores: Record<string, number>   // { helpfulness: 4.2, coherence: 4.8, ... }
  errors: UniqueError[]               // deduplicated errors with severity
  thresholdViolations: string[]       // which thresholds were breached
}
```

## Failure Output

When a scenario fails, vitest shows a clear error message:

```
 ✗ Agentest > runs all scenarios
   AssertionError: Scenario "user books a morning slot" failed:
     - Trajectory assertion failed in 1 conversation (missing: create_booking)
     - helpfulness: 3.2 (threshold: 3.5)
     - 1 critical error: Agent leaked API key in response

   Conversations: 2/3 passed
```

## Combining with the CLI

Vitest integration and the CLI are complementary:

| | CLI (`npx agentest run`) | Vitest (`npx vitest run`) |
|---|---|---|
| **Best for** | CI pipelines, quick iteration | IDE integration, mixed test suites |
| **Reporters** | Console, JSON, GitHub Actions | Vitest reporters |
| **Watch mode** | `--watch` flag | Vitest's built-in watch |
| **Filtering** | `--scenario "name"` | Vitest's `--grep` or `.only` |
| **Comparison mode** | Supported | Use `defineSimSuite` with comparison config |

You don't need to choose — use both. The CLI for CI and quick runs, vitest for IDE-driven development.

## Tips

- **Always set explicit timeouts** on agent tests. The default vitest timeout (5s) is way too short.
- **Use `describe.concurrent`** if you want vitest to run multiple scenario tests in parallel.
- **Filter with `.only`** during development: `it.only('booking flow', ...)` to run just one scenario.
- **Keep agent tests in a separate directory** (e.g., `tests/agent/`) if you want to run them separately from unit tests: `npx vitest run tests/agent/`.

## Next Steps

- [Getting Started](/guide/getting-started) — CLI-based quick start
- [Pass/Fail Logic](/guide/pass-fail-logic) — What makes scenarios pass or fail
- [CLI Reference](/reference/cli) — CLI options and reporters
