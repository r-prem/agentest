# Basic Scenario Example

A complete walkthrough of writing your first Agentest scenario.

## Scenario: Booking a Haircut

Let's test a booking agent that helps users schedule haircut appointments.

### The Agent

Our agent has access to two tools:

- `check_availability(date)` - Check available time slots
- `create_booking(date, time, service)` - Create a booking

### The Test Scenario

We want to verify that the agent can successfully book a morning slot for a user.

## Complete Example

```ts
// tests/booking.sim.ts
import { scenario, sequence } from 'agentest'

scenario('user books a morning slot', {
  // Define the simulated user's personality and communication style
  profile: 'Busy professional who prefers mornings. Direct communication style.',

  // What the user is trying to accomplish
  goal: 'Book a haircut for next Tuesday morning.',

  // Facts the simulated user "knows"
  knowledge: [
    { content: 'The salon is open Tuesday 08:00-18:00.' },
    { content: 'Standard haircut takes 45 minutes.' },
    { content: 'Today is Monday, March 24, 2026.' },
  ],

  // Mock tool responses
  mocks: {
    tools: {
      // Function mock - returns different data based on arguments
      check_availability: (args) => ({
        available: true,
        slots: ['09:00', '09:45', '10:30', '14:00', '15:30'],
        date: args.date,
      }),

      // Sequence mock - returns predefined values in order
      create_booking: sequence([
        {
          success: true,
          bookingId: 'BK-001',
          confirmationSent: true,
          details: {
            date: '2026-03-25',
            time: '09:00',
            service: 'haircut',
          },
        },
      ]),
    },
  },

  // Verify the agent called the right tools
  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        {
          name: 'check_availability',
          argMatchMode: 'ignore', // Don't check arguments
        },
        {
          name: 'create_booking',
          args: {
            date: '2026-03-25', // Must match exactly
            service: 'haircut',
          },
          argMatchMode: 'partial', // Other args are OK
        },
      ],
    },
  },
})
```

## Configuration

Create `agentest.config.ts`:

```ts
import { defineConfig } from 'agentest'

export default defineConfig({
  agent: {
    name: 'booking-agent',
    endpoint: 'http://localhost:3000/api/chat',
  },

  // Use default Anthropic provider for simulation
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  // Run 3 independent conversations per scenario
  conversationsPerScenario: 3,

  // Max 8 turns per conversation
  maxTurns: 8,

  // Evaluation metrics
  metrics: [
    'helpfulness',
    'coherence',
    'relevance',
    'goal_completion',
  ],

  // Minimum scores to pass
  thresholds: {
    helpfulness: 3.5,
    goal_completion: 0.8, // 80% of conversations must complete goal
  },
})
```

## Running the Test

```bash
npx agentest run
```

## Expected Output

```
Agentest running 1 scenario(s)

  ⠹ user books a morning slot → simulating conv-1-a3f8b2c1 turn 2/8 — calling agent

✓ user books a morning slot
  ✓ conv-1-a3f8b2c1 (2 turns, goal met, trajectory matched)
    helpfulness: 4.5, coherence: 5.0, relevance: 5.0, goal_completion: 1
  ✓ conv-2-d9e1f4a7 (3 turns, goal met, trajectory matched)
    helpfulness: 4.2, coherence: 4.8, relevance: 5.0, goal_completion: 1
  ✓ conv-3-e8f2g5h9 (2 turns, goal met, trajectory matched)
    helpfulness: 4.8, coherence: 5.0, relevance: 5.0, goal_completion: 1

  Average scores:
    helpfulness: 4.5 (threshold: 3.5 ✓)
    coherence: 4.9
    relevance: 5.0
    goal_completion: 1.0 (threshold: 0.8 ✓)

1/1 scenarios passed
```

## What Happened?

For each of the 3 conversations:

1. **Turn 1**: SimulatedUser introduces their goal
   - Agent asks about preferred date/time
2. **Turn 2**: SimulatedUser specifies Tuesday morning
   - Agent calls `check_availability('2026-03-25')`
   - Mock returns available slots
   - Agent presents options
3. **Turn 3**: SimulatedUser chooses 09:00
   - Agent calls `create_booking('2026-03-25', '09:00', 'haircut')`
   - Mock returns success
   - Agent confirms booking
   - SimulatedUser's goal is met → conversation ends

Then:
- **Trajectory assertions** verify both tools were called
- **LLM-as-judge metrics** score each turn
- **Thresholds** check average scores
- **Result**: All conversations passed ✓

## Next Steps

- [Error Handling Example](/examples/error-handling) - Test error recovery
- [Multi-turn Conversations](/examples/multi-turn) - Complex scenarios
- [Tool Sequences](/examples/tool-sequences) - Advanced mocking
- [Mocks Guide](/guide/mocks) - Learn more about mocking
