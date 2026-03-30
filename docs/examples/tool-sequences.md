# Tool Call Sequences

Advanced mocking with sequences and stateful behavior.

## Basic Sequence

```ts
import { sequence } from '@agentesting/agentest'

scenario('inventory depletes over time', {
  profile: 'Customer buying multiple items.',
  goal: 'Buy 3 shirts.',

  mocks: {
    tools: {
      // Returns different inventory on each call
      check_inventory: sequence([
        { item: 'shirt', available: 10 },
        { item: 'shirt', available: 7 },  // after first purchase
        { item: 'shirt', available: 4 },  // after second purchase
      ]),

      purchase: () => ({ success: true }),
    },
  },
})
```

## Stateful Mocks with Call Index

```ts
mocks: {
  tools: {
    get_data: (args, ctx) => {
      // ctx.callIndex increments on each call
      if (ctx.callIndex === 0) {
        return { status: 'pending' }
      }
      if (ctx.callIndex === 1) {
        return { status: 'processing' }
      }
      return { status: 'complete', data: { result: 'success' } }
    },
  },
}
```

## Conditional Sequences

```ts
import { sequence } from '@agentesting/agentest'

mocks: {
  tools: {
    create_booking: sequence([
      { success: true, bookingId: 'BK-001' },    // First call succeeds
      { success: false, error: 'duplicate' },     // Second call fails (duplicate)
      { success: true, bookingId: 'BK-002' },     // Third call succeeds
    ]),
  },
}
```

## Context-Aware Mocking

```ts
mocks: {
  tools: {
    send_notification: (args, ctx) => {
      console.log(`Call ${ctx.callIndex} in conversation ${ctx.conversationId}`)
      console.log(`Turn ${ctx.turnIndex}`)

      // Return different results based on context
      return {
        sent: true,
        method: ctx.turnIndex < 2 ? 'email' : 'sms',
      }
    },
  },
}
```

## Exhaustion Behavior

Sequences repeat the last value when exhausted:

```ts
const mock = sequence([
  { value: 1 },
  { value: 2 },
  { value: 3 },
])

mock()  // → { value: 1 }
mock()  // → { value: 2 }
mock()  // → { value: 3 }
mock()  // → { value: 3 }  (repeats)
mock()  // → { value: 3 }  (repeats)
```

## Combining Function and Sequence Mocks

```ts
import { sequence } from '@agentesting/agentest'

mocks: {
  tools: {
    // Sequence mock
    check_status: sequence([
      { status: 'pending' },
      { status: 'complete' },
    ]),

    // Function mock
    get_details: (args) => ({
      id: args.id,
      name: 'Item Name',
    }),

    // Function that uses context
    send_email: (args, ctx) => ({
      sent: true,
      attempt: ctx.callIndex + 1,
    }),
  },
}
```

## Reset Behavior

Sequences automatically reset at the start of each conversation:

```ts
scenario('sequences reset per conversation', {
  profile: 'User',
  goal: 'Test sequence reset',
  conversationsPerScenario: 3,

  mocks: {
    tools: {
      counter: sequence([
        { count: 1 },
        { count: 2 },
        { count: 3 },
      ]),
    },
  },
})

// Conversation 1: calls get [1, 2, 3, 3, ...]
// Conversation 2: calls get [1, 2, 3, 3, ...] (reset!)
// Conversation 3: calls get [1, 2, 3, 3, ...] (reset!)
```
