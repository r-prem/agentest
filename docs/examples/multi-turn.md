# Multi-turn Conversations

Test complex scenarios that require multiple interactions.

## Simulated Multi-turn (LLM-driven)

Use `profile` and `goal` to let the simulated user drive the conversation autonomously. Agentest's LLM-powered user generates realistic messages and decides when the goal is met.

### Example: Multi-step Booking Flow

```ts
import { scenario, sequence } from '@agentesting/agentest'

scenario('user completes multi-step booking with questions', {
  profile: 'Cautious user who asks clarifying questions.',
  goal: 'Book a haircut, but first confirm the cancellation policy and price.',

  knowledge: [
    { content: 'I prefer morning appointments.' },
    { content: 'I want to know if I can cancel without penalty.' },
  ],

  mocks: {
    tools: {
      get_cancellation_policy: () => ({
        policy: 'Free cancellation up to 24 hours before appointment',
        fee: 0,
      }),

      get_pricing: (args) => ({
        service: args.service,
        price: 45,
        currency: 'USD',
        duration: '45 minutes',
      }),

      check_availability: (args) => ({
        available: true,
        slots: ['09:00', '09:45', '10:30'],
        date: args.date,
      }),

      create_booking: (args) => ({
        success: true,
        bookingId: 'BK-001',
        total: 45,
      }),
    },
  },

  // Allow more turns for this complex flow
  maxTurns: 12,

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'get_cancellation_policy', argMatchMode: 'ignore' },
        { name: 'get_pricing', argMatchMode: 'ignore' },
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    },
  },
})
```

### Expected Conversation Flow

```
Turn 1:
User: I want to book a haircut but I have some questions first
Agent: Of course! What would you like to know?

Turn 2:
User: What's the cancellation policy?
Agent: *calls get_cancellation_policy*
Agent: Free cancellation up to 24 hours before your appointment

Turn 3:
User: And how much does a haircut cost?
Agent: *calls get_pricing*
Agent: A standard haircut is $45 and takes about 45 minutes

Turn 4:
User: OK, I'd like to book for next Tuesday morning
Agent: *calls check_availability*
Agent: I have these morning slots: 09:00, 09:45, 10:30

Turn 5:
User: 09:00 works for me
Agent: *calls create_booking*
Agent: Perfect! Booked for Tuesday at 09:00. Confirmation: BK-001
```

### Testing Conversation Depth

Use `maxTurns` to accommodate longer conversations:

```ts
scenario('complex troubleshooting scenario', {
  profile: 'User with a technical problem requiring back-and-forth diagnosis.',
  goal: 'Resolve the login issue.',
  maxTurns: 15,  // Allow up to 15 turns
})
```

### Multiple Conversations

Run more conversations to test variance:

```ts
scenario('unpredictable user behavior', {
  profile: 'User changes their mind frequently.',
  goal: 'Eventually book an appointment.',
  conversationsPerScenario: 10,  // Run 10 times
})
```

## Scripted Multi-turn (Deterministic)

Use `turns` to define exact user messages for each turn. This skips the simulated user entirely — no LLM is used to generate messages. Each turn can have its own trajectory assertions.

This is ideal for testing **context carry-forward**, **conversation continuity**, and **deterministic regression tests**.

### Example: Context Carry-forward

```ts
import { scenario } from '@agentesting/agentest'

scenario('follow-up reuses order context', {
  turns: [
    {
      userMessage: 'What is the status of order ORD-42?',
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [
            { name: 'get_order', args: { id: 'ORD-42' }, argMatchMode: 'partial' },
          ],
        },
      },
    },
    {
      userMessage: 'And what are the shipping details for that order?',
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [
            { name: 'get_shipping', args: { orderId: 'ORD-42' }, argMatchMode: 'partial' },
          ],
        },
      },
    },
  ],

  mocks: {
    tools: {
      get_order: () => ({ status: 'shipped', items: 3, total: 89.99 }),
      get_shipping: () => ({ carrier: 'FedEx', eta: '2024-03-15', trackingId: 'FX-99887' }),
    },
  },
})
```

The second turn says "that order" — the agent must carry forward that it refers to order `ORD-42` from the previous turn. The per-turn assertion verifies this.

### Example: Domain Switch with Follow-up Export

```ts
scenario('cross-domain pivot then export', {
  turns: [
    {
      userMessage: 'Show me the sales for product SKU-200 from Jan 1 to Jan 7.',
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [{ name: 'get_sales', argMatchMode: 'ignore' }],
        },
      },
    },
    {
      userMessage: 'Were there any returns during that period?',
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [
            { name: 'get_returns', args: { productId: 'SKU-200' }, argMatchMode: 'partial' },
          ],
        },
      },
    },
    {
      userMessage: 'Export that to CSV',
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [{ name: 'export_to_csv', argMatchMode: 'ignore' }],
        },
      },
    },
  ],

  mocks: {
    tools: {
      get_sales: () => ({ units: 124, revenue: 4960.00 }),
      get_returns: () => ({ count: 3, refunded: 120.00 }),
      export_to_csv: () => ({ fileId: 'export-001', url: '/download/export-001' }),
    },
  },
})
```

### Key Differences from Simulated Multi-turn

| | Simulated (`profile` + `goal`) | Scripted (`turns`) |
|---|---|---|
| User messages | Generated by LLM | Predetermined |
| Deterministic | No (LLM variance) | Yes |
| `conversationsPerScenario` default | From config (usually 3) | 1 |
| LLM evaluation | Full metrics + goal completion | Only if `goal` is provided |
| Per-turn assertions | No (cumulative only) | Yes |
| Best for | Exploratory testing, persona variance | Regression tests, context carry-forward |

### Scripted Scenarios with Evaluation

To enable LLM-as-judge evaluation on scripted scenarios, provide a `goal`:

```ts
scenario('follow-up with quality evaluation', {
  goal: 'Get order status and shipping details for order ORD-42.',

  turns: [
    { userMessage: 'What is the status of order ORD-42?' },
    { userMessage: 'And what are the shipping details?' },
  ],

  mocks: {
    tools: {
      get_order: () => ({ status: 'shipped', items: 3 }),
      get_shipping: () => ({ carrier: 'FedEx', eta: '2024-03-15' }),
    },
  },
})
```

Without a `goal`, scripted scenarios skip LLM evaluation entirely and rely on trajectory assertions for pass/fail.

### Cumulative + Per-turn Assertions

You can combine scenario-level cumulative assertions with per-turn assertions:

```ts
scenario('full booking flow', {
  // Cumulative: these tools must all be called across the whole conversation
  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    },
  },

  turns: [
    {
      userMessage: 'Is Tuesday morning available?',
      // Per-turn: only check_availability should be called in this turn
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [{ name: 'check_availability', argMatchMode: 'ignore' }],
        },
      },
    },
    {
      userMessage: 'Book the 9am slot.',
      // Per-turn: create_booking should be called in this turn
      assertions: {
        toolCalls: {
          matchMode: 'contains',
          expected: [{ name: 'create_booking', argMatchMode: 'ignore' }],
        },
      },
    },
  ],

  mocks: {
    tools: {
      check_availability: () => ({ available: true, slots: ['09:00', '10:30'] }),
      create_booking: () => ({ success: true, bookingId: 'BK-001' }),
    },
  },
})
```
