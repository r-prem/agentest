---
layout: home

hero:
  name: Agentest
  text: Vitest for AI agents
  tagline: Scenario-based testing with simulated users, tool-call mocks, and LLM-as-judge evaluation
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/r-prem/agentest
  image:
    src: /logo.svg
    alt: Agentest

features:
  - icon: 🤖
    title: Scenario-based Tests
    details: Define user personas, goals, and knowledge — Agentest generates realistic multi-turn conversations
  - icon: 🔧
    title: Tool-call Mocks
    details: Intercept and control tool calls with functions, sequences, and error simulation
  - icon: ✅
    title: Trajectory Assertions
    details: Verify tool call order and arguments with strict, contains, unordered, and within match modes
  - icon: 📊
    title: LLM-as-judge Metrics
    details: Helpfulness, coherence, relevance, faithfulness, goal completion, behavior failure detection
  - icon: 🔄
    title: Comparison Mode
    details: Run the same scenarios against multiple models/configs side-by-side
  - icon: 🚀
    title: CI-ready CLI
    details: Exit codes, JSON reporter, GitHub Actions annotations, watch mode
  - icon: 📦
    title: Framework Demos
    details: Complete runnable examples for LangChain, Vercel AI SDK, and CrewAI with 24 scenarios each
---

## Quick Start

Install Agentest:

```bash
npm install @agentesting/agentest --save-dev
```

Create a config file:

```ts
// agentest.config.ts
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  agent: {
    name: 'my-agent',
    endpoint: 'http://localhost:3000/api/chat',
  },
})
```

Write a scenario:

```ts
// tests/booking.sim.ts
import { scenario, sequence } from '@agentesting/agentest'

scenario('user books a morning slot', {
  profile: 'Busy professional who prefers mornings.',
  goal: 'Book a haircut for next Tuesday morning.',

  mocks: {
    tools: {
      check_availability: (args) => ({
        available: true,
        slots: ['09:00', '09:45', '10:30'],
      }),
      create_booking: sequence([
        { success: true, bookingId: 'BK-001' },
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

Run:

```bash
# If your agent runs on localhost, allow private endpoints:
AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1 npx agentest run
```

## Why Agentest?

Testing agents is not like testing regular APIs. Traditional API tests send a request and assert on the response. Agent tests need to handle multi-turn conversations where the agent decides which tools to call, in what order, with what arguments — and the "correct" output is subjective.

Agentest solves this by:

- **Simulating realistic users** with LLM-powered personas that talk to your agent
- **Intercepting tool calls** and resolving them through your mocks
- **Verifying trajectories** with deterministic assertions on tool call order
- **Evaluating quality** with LLM-as-judge metrics across 8 dimensions

Agentest complements eval platforms and observability tools — it doesn't replace them. Use Agentest to *run* your agent through test scenarios in CI. Use LangSmith/Langfuse to *observe* your agent in production.
