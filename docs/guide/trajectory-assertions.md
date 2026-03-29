# Trajectory Assertions

Verify that your agent called the right tools, in the right order, with the right arguments — without any LLM evaluation. Trajectory assertions are deterministic and fast.

## Why Use Trajectory Assertions?

LLM-as-judge metrics evaluate *quality* (was the response helpful?). Trajectory assertions verify *behavior* (did the agent call the right tools?). They're complementary:

- **Zero LLM cost** — no API calls, instant results
- **Fully reproducible** — same inputs always produce the same pass/fail
- **Catches logic bugs** — agent used `delete_booking` instead of `update_booking`
- **Verifies workflows** — agent checked availability *before* booking

## Basic Usage

```ts
scenario('user books a morning slot', {
  profile: 'Busy professional.',
  goal: 'Book a haircut for Tuesday morning.',

  mocks: {
    tools: {
      check_availability: () => ({ available: true, slots: ['09:00'] }),
      create_booking: () => ({ success: true, bookingId: 'BK-001' }),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    },
  },
})
```

Assertions are checked **per-conversation**. If any conversation in the scenario fails the assertion, the entire scenario fails.

## Match Modes

The `matchMode` controls how the expected tool calls are compared against the actual tool calls the agent made.

### `strict`

Exact tools in exact order, exact count. No extra calls allowed.

```ts
matchMode: 'strict',
expected: [
  { name: 'check_availability', argMatchMode: 'ignore' },
  { name: 'create_booking', argMatchMode: 'ignore' },
]

// ✅ PASS: [check_availability, create_booking]
// ❌ FAIL: [create_booking, check_availability]        — wrong order
// ❌ FAIL: [check_availability, create_booking, log]   — extra call
// ❌ FAIL: [check_availability]                         — missing call
```

**Use when:** You know the precise sequence the agent must follow. Good for well-defined workflows like checkout flows or multi-step form submissions.

### `unordered`

All expected tools must appear, any order. No extra calls allowed.

```ts
matchMode: 'unordered',
expected: [
  { name: 'get_user', argMatchMode: 'ignore' },
  { name: 'get_preferences', argMatchMode: 'ignore' },
]

// ✅ PASS: [get_user, get_preferences]
// ✅ PASS: [get_preferences, get_user]
// ❌ FAIL: [get_user, get_preferences, log_event]  — extra call
// ❌ FAIL: [get_user]                                — missing call
```

**Use when:** The agent needs to call specific tools but the order doesn't matter. Good for data-gathering steps where the agent might fetch user info and preferences in either order.

### `contains`

All expected tools must appear in the specified order. Extra calls between or around them are allowed.

```ts
matchMode: 'contains',
expected: [
  { name: 'check_availability', argMatchMode: 'ignore' },
  { name: 'create_booking', argMatchMode: 'ignore' },
]

// ✅ PASS: [check_availability, create_booking]
// ✅ PASS: [check_availability, log_event, create_booking]
// ✅ PASS: [get_user, check_availability, create_booking, send_email]
// ❌ FAIL: [create_booking, check_availability]  — wrong order
// ❌ FAIL: [check_availability]                   — missing create_booking
```

**Use when:** You care about key tools being called in a specific order but the agent may call other tools too. This is the **most commonly used mode** — it's flexible enough to handle non-deterministic agent behavior while still verifying the critical path.

### `within`

Every actual tool call must be in the expected set. Missing calls from the expected set are OK. Think of it as a whitelist.

```ts
matchMode: 'within',
expected: [
  { name: 'check_availability', argMatchMode: 'ignore' },
  { name: 'create_booking', argMatchMode: 'ignore' },
  { name: 'send_confirmation', argMatchMode: 'ignore' },
]

// ✅ PASS: [check_availability, create_booking]                — skipped send_confirmation, OK
// ✅ PASS: [check_availability]                                 — only called one, OK
// ✅ PASS: [check_availability, create_booking, send_confirmation]
// ❌ FAIL: [check_availability, delete_booking]                — delete_booking not in set
```

**Use when:** You want to restrict which tools the agent is *allowed* to use. Good for safety testing — ensure the agent never calls `delete_account` or `send_email` during a read-only operation.

## Choosing the Right Mode

| Scenario | Recommended Mode |
|----------|-----------------|
| Critical workflow with exact steps | `strict` |
| Must call these tools, order doesn't matter | `unordered` |
| Must call key tools in order, extras OK | `contains` |
| Agent may only use these tools | `within` |
| First time testing a new scenario | `contains` (most forgiving) |

Start with `contains` and tighten to `strict` as you gain confidence in your agent's behavior.

## Argument Matching

Each expected tool call specifies how its arguments are compared against the actual arguments the agent passed.

### `ignore` (default)

Don't check arguments at all. Only verify the tool was called.

```ts
{ name: 'search', argMatchMode: 'ignore' }

// ✅ search({ query: 'anything', limit: 50 })
// ✅ search({ })
// ✅ search({ unexpected: 'field' })
```

**Use when:** You care *that* the tool was called but not *how*. Good for tools where the agent has discretion over arguments.

### `partial`

All keys in `expected.args` must appear in the actual args with the same values. Extra keys in the actual args are allowed.

```ts
{
  name: 'create_booking',
  args: { date: '2026-04-01', service: 'haircut' },
  argMatchMode: 'partial',
}

// ✅ create_booking({ date: '2026-04-01', service: 'haircut', time: '09:00' })
// ✅ create_booking({ date: '2026-04-01', service: 'haircut' })
// ❌ create_booking({ date: '2026-04-02', service: 'haircut' })  — wrong date
// ❌ create_booking({ service: 'haircut' })                       — missing date
```

**Use when:** You want to verify specific arguments but the agent may include additional fields. Good for checking that a booking uses the right date while allowing the agent to choose the time.

### `exact`

Arguments must match exactly via deep equality. No extra keys allowed.

```ts
{
  name: 'checkout',
  args: { currency: 'USD', confirm: true },
  argMatchMode: 'exact',
}

// ✅ checkout({ currency: 'USD', confirm: true })
// ❌ checkout({ currency: 'USD', confirm: true, coupon: 'SAVE10' })  — extra key
// ❌ checkout({ currency: 'EUR', confirm: true })                     — wrong value
```

**Use when:** Arguments must be precise. Good for financial operations, API calls with strict contracts, or when testing that the agent passes exactly the right parameters.

## Combining Match and Arg Modes

You can mix argument match modes within the same assertion:

```ts
assertions: {
  toolCalls: {
    matchMode: 'contains',
    expected: [
      // Just verify this tool was called
      { name: 'search_products', argMatchMode: 'ignore' },

      // Verify the right product was added
      { name: 'add_to_cart', args: { productId: 'SKU-123' }, argMatchMode: 'partial' },

      // Verify exact checkout parameters
      { name: 'checkout', args: { currency: 'USD', confirm: true }, argMatchMode: 'exact' },
    ],
  },
},
```

## Failure Output

When a trajectory assertion fails, Agentest reports exactly what went wrong:

```
✗ conv-2-d9e1f4a7 (2 turns, goal met, trajectory FAILED)
  Missing tool calls: create_booking
  Extra tool calls: delete_booking
  Ordering issues: check_availability must come before create_booking

  Actual calls: [check_availability, delete_booking]
  Expected (contains): [check_availability, create_booking]
```

The failure message includes:

| Field | Description |
|-------|-------------|
| `missingCalls` | Expected tools that were never called |
| `extraCalls` | Tools that were called but shouldn't have been (for `strict`/`unordered`) |
| `orderingIssues` | Tools that appeared in the wrong order (for `strict`/`contains`) |

## Trajectory Assertions vs. LLM Metrics

Use both for comprehensive coverage:

| Check | Trajectory Assertions | LLM Metrics |
|-------|----------------------|-------------|
| Did the agent call the right tools? | ✅ | |
| Did the agent call tools in the right order? | ✅ | |
| Did the agent pass correct arguments? | ✅ | |
| Was the response helpful? | | ✅ |
| Did the agent hallucinate? | | ✅ |
| Did the agent handle errors well? | | ✅ |

**Trajectory assertions catch logic bugs. LLM metrics catch quality issues.** Use trajectory assertions for the critical path and LLM metrics for overall quality.

## Next Steps

- [Mocks](/guide/mocks) — Control tool behavior
- [Evaluation Metrics](/guide/evaluation-metrics) — Quality assessment
- [Pass/Fail Logic](/guide/pass-fail-logic) — How assertions affect pass/fail
- [Scenario API](/reference/scenario-api) — Full assertion type reference
