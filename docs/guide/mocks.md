# Mocks

Control tool behavior with mocks and sequences. Mocks intercept tool calls from your agent and return controlled responses, allowing you to test agent behavior without real external services.

## Overview

When your agent calls a tool during simulation, Agentest intercepts the call and resolves it through your mock instead of calling the real tool. This gives you complete control over:

- What data the agent receives
- How tools behave in different scenarios
- Error conditions and edge cases
- Multi-step workflows with sequences

**No instrumentation needed** — your agent code doesn't change. Agentest owns the tool-call loop and transparently injects mock results.

## Function Mocks

The most common type of mock. Define a function that receives the tool arguments and returns the mock result:

```ts
mocks: {
  tools: {
    get_weather: (args) => ({
      temperature: 72,
      condition: 'sunny',
      location: args.city,
    }),
  },
},
```

### Function Signature

```ts
type ToolMockFn = (
  args: Record<string, unknown>,
  ctx: MockContext
) => unknown | Promise<unknown>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `args` | `Record<string, unknown>` | Parsed tool call arguments from the agent |
| `ctx` | `MockContext` | Context about the current call (see below) |

**Returns:** The mock result (any JSON-serializable value, or a Promise)

### Using Arguments

Access the agent's tool call arguments to return appropriate data:

```ts
mocks: {
  tools: {
    search_products: (args) => {
      // args.query, args.category, args.maxResults, etc.
      if (args.query === 'laptop') {
        return {
          results: [
            { id: 1, name: 'MacBook Pro', price: 2399 },
            { id: 2, name: 'ThinkPad X1', price: 1899 },
          ],
          total: 2,
        }
      }
      return { results: [], total: 0 }
    },
  },
},
```

### Async Mocks

Mocks can be async to simulate latency or perform conditional logic:

```ts
mocks: {
  tools: {
    search_database: async (args) => {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 100))

      // Conditional logic
      if (args.query === 'not found') {
        return { results: [] }
      }

      return {
        results: [
          { id: 1, title: 'Result 1' },
          { id: 2, title: 'Result 2' },
        ],
      }
    },
  },
},
```

## Mock Context

Every mock receives a `ctx` parameter with information about the current call:

```ts
interface MockContext {
  callIndex: number       // How many times this tool has been called (0-indexed)
  conversationId: string  // Current conversation ID (e.g., 'conv-1-abc123')
  turnIndex: number       // Current turn number (0-indexed)
}
```

### Use Cases for Context

**1. Return different data on successive calls:**

```ts
mocks: {
  tools: {
    check_status: (args, ctx) => {
      if (ctx.callIndex === 0) {
        return { status: 'processing' }
      } else if (ctx.callIndex === 1) {
        return { status: 'complete' }
      }
      return { status: 'archived' }
    },
  },
},
```

**2. Identify specific conversations:**

```ts
mocks: {
  tools: {
    get_user_id: (args, ctx) => ({
      userId: `user-${ctx.conversationId}`,
      // Each conversation gets a unique user ID
    }),
  },
},
```

**3. Track turn-specific behavior:**

```ts
mocks: {
  tools: {
    log_event: (args, ctx) => {
      console.log(`Turn ${ctx.turnIndex}: ${args.event}`)
      return { logged: true }
    },
  },
},
```

**Important:** `ctx.callIndex` resets to 0 at the start of each conversation, so every conversation gets a fresh call count.

## Sequence Mocks

Use `sequence()` to return different values on successive calls. This is perfect for testing multi-step workflows.

```ts
import { sequence } from 'agentest'

mocks: {
  tools: {
    create_order: sequence([
      { success: true, orderId: 'ORD-001' },   // first call
      { success: false, error: 'duplicate' },  // second call
      { success: true, orderId: 'ORD-002' },   // third call
    ]),
  },
},
```

### How Sequences Work

1. **First call** returns the first value
2. **Second call** returns the second value
3. **Third call** returns the third value
4. **Fourth call and beyond** repeat the last value

**Example:**

```ts
create_order: sequence([
  { success: true, orderId: 'ORD-001' },
  { success: true, orderId: 'ORD-002' },
])

// Calls:
// 1st call → { success: true, orderId: 'ORD-001' }
// 2nd call → { success: true, orderId: 'ORD-002' }
// 3rd call → { success: true, orderId: 'ORD-002' }  ← repeats last
// 4th call → { success: true, orderId: 'ORD-002' }  ← repeats last
```

### Sequence Reset Behavior

**Sequences reset at the start of each conversation**, so every conversation starts with the first value.

```ts
create_order: sequence([
  { success: true, orderId: 'ORD-001' },
  { success: false, error: 'duplicate' },
])

// Conversation 1:
//   1st call → ORD-001
//   2nd call → duplicate error

// Conversation 2:  ← resets
//   1st call → ORD-001  ← back to first value
//   2nd call → duplicate error

// Conversation 3:  ← resets again
//   1st call → ORD-001
```

This ensures consistent behavior across all conversations in a scenario.

### When to Use Sequences

**Use sequences when:**
- Testing retry logic (first call fails, second succeeds)
- Simulating progressive state changes (pending → processing → complete)
- Testing workflows that require multiple tool calls
- Verifying the agent handles changing data correctly

**Example: Testing retry logic**

```ts
scenario('agent retries on failure', {
  profile: 'User trying to book an appointment.',
  goal: 'Successfully book an appointment.',

  mocks: {
    tools: {
      // First call fails, second succeeds
      create_booking: sequence([
        { success: false, error: 'Server busy, please retry' },
        { success: true, bookingId: 'BK-001' },
      ]),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'strict',
      expected: [
        { name: 'create_booking', argMatchMode: 'ignore' },  // first attempt
        { name: 'create_booking', argMatchMode: 'ignore' },  // retry
      ],
    },
  },
})
```

## Error Simulation

Throw from a mock to simulate a tool failure. The error message is injected back to the agent as a tool result.

```ts
mocks: {
  tools: {
    flaky_api: (args) => {
      throw new Error('Connection timeout')
    },
  },
},
```

The agent receives:

```json
{
  "error": "Connection timeout"
}
```

### Conditional Errors

Use context to simulate intermittent failures:

```ts
mocks: {
  tools: {
    unreliable_service: (args, ctx) => {
      // Fail on first call, succeed on retry
      if (ctx.callIndex === 0) {
        throw new Error('Service temporarily unavailable')
      }
      return { success: true, data: 'result' }
    },
  },
},
```

### Testing Error Handling

Use errors to verify the agent:
- Retries appropriately
- Provides helpful error messages to the user
- Doesn't crash or give up immediately
- Falls back to alternative tools

**Example:**

```ts
scenario('agent handles API errors gracefully', {
  profile: 'User asking for weather information.',
  goal: 'Get the weather forecast.',

  mocks: {
    tools: {
      get_weather_api: (args, ctx) => {
        // First attempt fails
        if (ctx.callIndex === 0) {
          throw new Error('API rate limit exceeded')
        }
        // Retry succeeds
        return { temperature: 72, condition: 'sunny' }
      },
    },
  },
})
```

The agent should:
1. Call `get_weather_api` → receive error
2. Inform user about the issue
3. Retry the call → receive successful result
4. Provide weather information to user

## Unmocked Tools

What happens when the agent calls a tool that has no mock defined?

### Error Mode (default)

```ts
unmockedTools: 'error',  // default
```

Agentest throws an `AgentestError` with a helpful message:

```
ERROR: Tool 'send_confirmation_email' was called but no mock is defined.

Add a mock in your scenario:

mocks: {
  tools: {
    send_confirmation_email: (args) => ({
      success: true,
      messageId: 'msg-123',
    }),
  },
}
```

The conversation is recorded as an error and the scenario fails.

**When to use:**
- You want to catch unexpected tool usage
- You're mocking all tools the agent should call
- You want strict control over tool behavior

### Passthrough Mode

```ts
unmockedTools: 'passthrough',
```

Agentest returns `undefined` as the tool result. The agent sees `null` in the response.

**When to use:**
- Your agent uses many tools and you only want to mock a subset
- You're testing specific tool interactions and don't care about others
- The agent can handle `null` tool results gracefully

**Example:**

```ts
export default defineConfig({
  unmockedTools: 'passthrough',
  // ...
})

scenario('test booking flow', {
  mocks: {
    tools: {
      // Only mock the critical tools
      check_availability: (args) => ({ available: true }),
      create_booking: (args) => ({ success: true }),
      // send_email, log_analytics, etc. will return undefined
    },
  },
})
```

## Advanced Mock Patterns

### Stateful Mocks

Track state across calls within a conversation:

```ts
// Outside the scenario definition
const cartState = new Map<string, any[]>()

scenario('user manages shopping cart', {
  mocks: {
    tools: {
      add_to_cart: (args, ctx) => {
        const cart = cartState.get(ctx.conversationId) || []
        cart.push(args.item)
        cartState.set(ctx.conversationId, cart)
        return { cartSize: cart.length }
      },

      get_cart: (args, ctx) => {
        const cart = cartState.get(ctx.conversationId) || []
        return { items: cart, total: cart.length }
      },
    },
  },
})
```

**Note:** State persists across turns within a conversation but not across conversations.

### Dynamic Data Generation

Generate realistic data based on arguments:

```ts
mocks: {
  tools: {
    search: (args) => ({
      results: Array.from({ length: args.limit || 5 }, (_, i) => ({
        id: i + 1,
        title: `Result for "${args.query}" #${i + 1}`,
        score: Math.random(),
      })),
      query: args.query,
    }),
  },
},
```

### Combining Sequences and Functions

You can't use both directly, but you can wrap a sequence in a function:

```ts
import { sequence } from 'agentest'

const statusSequence = sequence(['pending', 'processing', 'complete'])

mocks: {
  tools: {
    check_status: (args, ctx) => {
      const status = statusSequence.next()  // Note: this won't work as shown
      return { status, orderId: args.orderId }
    },
  },
}
```

**Better approach:** Use context-based logic instead:

```ts
mocks: {
  tools: {
    check_status: (args, ctx) => {
      const statuses = ['pending', 'processing', 'complete']
      const status = statuses[Math.min(ctx.callIndex, statuses.length - 1)]
      return { status, orderId: args.orderId }
    },
  },
},
```

## Testing Tool Call Order

Mocks work seamlessly with trajectory assertions:

```ts
scenario('user completes checkout', {
  profile: 'Customer ready to purchase.',
  goal: 'Complete the checkout process.',

  mocks: {
    tools: {
      validate_cart: (args) => ({ valid: true, total: 49.99 }),
      process_payment: (args) => ({ success: true, transactionId: 'TXN-001' }),
      send_confirmation: (args) => ({ sent: true, emailId: 'EMAIL-001' }),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'strict',  // exact order required
      expected: [
        { name: 'validate_cart', argMatchMode: 'ignore' },
        { name: 'process_payment', argMatchMode: 'ignore' },
        { name: 'send_confirmation', argMatchMode: 'ignore' },
      ],
    },
  },
})
```

If the agent calls tools in the wrong order (e.g., `process_payment` before `validate_cart`), the trajectory assertion fails.

See [Trajectory Assertions](/guide/trajectory-assertions) for match modes and argument matching.

## Best Practices

### 1. Return Realistic Data

Mocks should return data that matches what the real tool would return:

```ts
// Good: realistic structure
get_user: (args) => ({
  id: args.userId,
  name: 'Alice Johnson',
  email: 'alice@example.com',
  preferences: {
    notifications: true,
    theme: 'dark',
  },
})

// Bad: minimal/unrealistic
get_user: (args) => ({ name: 'User' })
```

### 2. Test Edge Cases

Use mocks to test scenarios that are hard to reproduce with real tools:

```ts
mocks: {
  tools: {
    check_inventory: (args) => {
      // Test out-of-stock scenario
      if (args.productId === 'SKU-123') {
        return { available: false, stock: 0 }
      }
      // Test low stock warning
      if (args.productId === 'SKU-456') {
        return { available: true, stock: 2, lowStockWarning: true }
      }
      return { available: true, stock: 100 }
    },
  },
},
```

### 3. Use Knowledge to Document Expected Behavior

Combine knowledge items with mocks to set clear expectations:

```ts
scenario('test discount application', {
  knowledge: [
    { content: 'VIP customers get 20% discount on all orders.' },
    { content: 'Discount code SAVE10 gives 10% off.' },
  ],

  mocks: {
    tools: {
      apply_discount: (args) => {
        if (args.code === 'SAVE10') {
          return { discountPercent: 10, finalPrice: 44.99 }
        }
        if (args.customerType === 'VIP') {
          return { discountPercent: 20, finalPrice: 39.99 }
        }
        return { discountPercent: 0, finalPrice: 49.99 }
      },
    },
  },
})
```

The `faithfulness` metric will check if the agent's responses match the discount logic.

### 4. Keep Mocks Simple

Avoid complex logic in mocks — they should be predictable and easy to understand:

```ts
// Good: simple and clear
get_weather: (args) => ({
  temperature: 72,
  condition: 'sunny',
})

// Avoid: complex logic that's hard to reason about
get_weather: (args) => {
  const day = new Date(args.date).getDay()
  const isWeekend = day === 0 || day === 6
  const baseTemp = isWeekend ? 75 : 68
  const variance = Math.random() * 10
  // ... 20 more lines
}
```

If you need complex behavior, consider multiple scenarios instead.

### 5. Document Why, Not What

Add comments for non-obvious mock behavior:

```ts
mocks: {
  tools: {
    // Simulates eventual consistency — first call returns stale data
    get_order_status: (args, ctx) => {
      if (ctx.callIndex === 0) {
        return { status: 'pending' }  // stale cache
      }
      return { status: 'shipped' }  // updated status
    },
  },
},
```

## Common Patterns

### Pattern: Testing Idempotency

Verify the agent doesn't call the same tool redundantly:

```ts
let callCount = 0

mocks: {
  tools: {
    get_config: (args) => {
      callCount++
      return { setting: 'value' }
    },
  },
},

// After simulation, check callCount === 1
```

Better: use trajectory assertions with `strict` mode to catch repeated calls.

### Pattern: Multi-Step Workflows

```ts
mocks: {
  tools: {
    start_process: (args) => ({ processId: 'PROC-001', status: 'started' }),
    check_progress: sequence([
      { processId: 'PROC-001', status: 'running', progress: 33 },
      { processId: 'PROC-001', status: 'running', progress: 66 },
      { processId: 'PROC-001', status: 'complete', progress: 100 },
    ]),
    finalize: (args) => ({ success: true, result: 'data' }),
  },
}
```

### Pattern: Dependent Tool Calls

Mock results can reference data from previous calls:

```ts
mocks: {
  tools: {
    create_session: (args) => ({
      sessionId: 'SESSION-123',
      expiresAt: '2026-03-30T12:00:00Z',
    }),

    // Expects sessionId from create_session
    upload_file: (args) => {
      if (args.sessionId !== 'SESSION-123') {
        throw new Error('Invalid session')
      }
      return { fileId: 'FILE-456', uploaded: true }
    },
  },
}
```

## Next Steps

- [Trajectory Assertions](/guide/trajectory-assertions) - Verify tool call sequences
- [Scenarios](/guide/scenarios) - Define test scenarios with mocks
- [Evaluation Metrics](/guide/evaluation-metrics) - Understand how mocks affect evaluation
- [Examples](/examples/tool-sequences) - See complex mock patterns in action
