# Error Handling Example

Test how your agent handles tool failures and errors.

## Scenario: Flaky API

```ts
import { scenario, sequence } from '@agentesting/agentest'

scenario('user books appointment with flaky API', {
  profile: 'Patient user willing to wait.',
  goal: 'Book a haircut appointment.',

  mocks: {
    tools: {
      // First call fails, second succeeds
      check_availability: sequence([
        // This will throw an error
        () => { throw new Error('Connection timeout') },
        // Retry succeeds
        { available: true, slots: ['09:00', '10:00'] },
      ]),

      create_booking: (args) => ({
        success: true,
        bookingId: 'BK-001',
      }),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        // Agent should retry check_availability
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    },
  },
})
```

## What This Tests

1. **Error Recovery**: Agent receives error result and retries
2. **User Communication**: Agent explains the issue to the user
3. **Successful Completion**: Despite the error, goal is achieved

## Expected Agent Behavior

```
Turn 1:
User: I need to book a haircut
Agent: Let me check availability... *calls check_availability*
       → Error: "Connection timeout"
Agent: I'm having trouble connecting to the booking system. Let me try again.

Turn 2:
Agent: *calls check_availability again*
       → Success: { available: true, slots: [...] }
Agent: I have these slots available: 09:00, 10:00

Turn 3:
User: I'll take 09:00
Agent: *calls create_booking*
       → Success
Agent: Booked! Your confirmation is BK-001
```

## Testing Different Error Types

```ts
mocks: {
  tools: {
    // Validation error
    create_booking: (args) => {
      if (!args.email) {
        throw new Error('Email is required')
      }
      return { success: true }
    },

    // Rate limit error
    check_availability: sequence([
      () => { throw new Error('Rate limit exceeded. Try again in 60 seconds.') },
      { available: true, slots: [] },
    ]),

    // Business logic error
    cancel_booking: (args) => {
      throw new Error('Cannot cancel within 24 hours of appointment')
    },
  },
}
```
