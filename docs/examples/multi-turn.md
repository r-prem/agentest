# Multi-turn Conversations

Test complex scenarios that require multiple interactions.

## Example: Multi-step Booking Flow

```ts
import { scenario, sequence } from 'agentest'

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

## Expected Conversation Flow

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

## Testing Conversation Depth

Use `maxTurns` to accommodate longer conversations:

```ts
scenario('complex troubleshooting scenario', {
  profile: 'User with a technical problem requiring back-and-forth diagnosis.',
  goal: 'Resolve the login issue.',
  maxTurns: 15,  // Allow up to 15 turns
})
```

## Multiple Conversations

Run more conversations to test variance:

```ts
scenario('unpredictable user behavior', {
  profile: 'User changes their mind frequently.',
  goal: 'Eventually book an appointment.',
  conversationsPerScenario: 10,  // Run 10 times
})
```
