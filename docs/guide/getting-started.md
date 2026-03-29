# Getting Started

Get up and running with Agentest in under 5 minutes.

## Installation

```bash
npm install @agentesting/agentest --save-dev
```

## Requirements

- Node.js >= 20
- Your agent must either expose an OpenAI-compatible chat completions endpoint, or use a custom handler function

## Quick Start

### 1. Create a config file

Create `agentest.config.ts` in your project root:

```ts
// agentest.config.ts
import { defineConfig } from 'agentest'

export default defineConfig({
  agent: {
    name: 'my-agent',
    endpoint: 'http://localhost:3000/api/chat',
  },
})
```

### 2. Write your first scenario

Create a test file with the `.sim.ts` extension:

```ts
// tests/booking.sim.ts
import { scenario, sequence } from 'agentest'

scenario('user books a morning slot', {
  profile: 'Busy professional who prefers mornings.',
  goal: 'Book a haircut for next Tuesday morning.',

  knowledge: [
    { content: 'The salon is open Tuesday 08:00-18:00.' },
    { content: 'Standard haircut takes 45 minutes.' },
  ],

  mocks: {
    tools: {
      check_availability: (args) => ({
        available: true,
        slots: ['09:00', '09:45', '10:30'],
        date: args.date,
      }),
      create_booking: sequence([
        { success: true, bookingId: 'BK-001', confirmationSent: true },
      ]),
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

### 3. Run the tests

```bash
npx agentest run
```

You should see output like:

```
Agentest running 1 scenario(s)

  ⠹ user books a morning slot → simulating conv-1-a3f8b2c1 turn 1/8 — calling agent

✓ user books a morning slot
  ✓ conv-1-a3f8b2c1 (2 turns, goal met, trajectory matched, helpfulness: 4.5, coherence: 5.0)
  ✓ conv-2-d9e1f4a7 (1 turns, goal met, trajectory matched, helpfulness: 5.0, coherence: 5.0)

1/1 scenarios passed
```

## What's Next?

- Learn [How It Works](/guide/how-it-works) to understand the execution model
- Explore [Configuration](/guide/configuration) options
- Read about [Mocks](/guide/mocks) to control tool behavior
- Set up [Trajectory Assertions](/guide/trajectory-assertions) to verify tool call sequences
- Understand [Evaluation Metrics](/guide/evaluation-metrics) for quality assessment

## Environment Variables

Agentest uses environment variables for LLM provider API keys:

```bash
# For Anthropic (default provider)
export ANTHROPIC_API_KEY=your-key-here

# For OpenAI
export OPENAI_API_KEY=your-key-here

# For Google
export GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

You can also set API keys for your agent endpoint:

```bash
export AGENT_API_KEY=your-agent-key
```

Then reference them in your config:

```ts
export default defineConfig({
  agent: {
    name: 'my-agent',
    endpoint: 'http://localhost:3000/api/chat',
    headers: {
      Authorization: 'Bearer ${AGENT_API_KEY}',  // interpolated from process.env
    },
  },
})
```

## File Structure

A typical Agentest project looks like this:

```
my-agent/
├── agentest.config.ts        # Main configuration
├── tests/
│   ├── booking.sim.ts        # Scenario files
│   ├── cancellation.sim.ts
│   └── error-handling.sim.ts
├── src/                      # Your agent code
└── package.json
```

## Next Steps

Now that you have Agentest running, dive deeper into:

- [Scenarios](/guide/scenarios) - Learn how to define realistic test scenarios
- [Mocks](/guide/mocks) - Master tool call mocking and error simulation
- [CLI Reference](/reference/cli) - Explore all CLI commands and options
