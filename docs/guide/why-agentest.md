# Why Agentest?

Learn why you need a specialized test runner for AI agents and how Agentest compares to other tools.

## The Agent Testing Problem

Testing agents is fundamentally different from testing regular APIs:

| Traditional APIs | AI Agents |
|---|---|
| Single request → single response | Multi-turn conversations |
| Deterministic output | Non-deterministic responses |
| Fixed logic paths | Agent decides tool call order |
| Easy to assert exact outputs | "Correct" output is subjective |

Traditional testing approaches fall short when your system under test is an autonomous agent that:

- Decides which tools to call and when
- Generates natural language responses
- Handles multi-turn state and context
- Adapts behavior based on previous interactions

## How Current Tools Fall Short

### Eval Platforms (DeepEval, LangSmith, Langfuse)

**What they're great at:**
- Scoring LLM outputs after the fact
- Dataset management and annotation
- Production observability and tracing

**What they don't do:**
- Generate realistic multi-turn conversations automatically
- Mock tool calls during execution
- Provide trajectory assertions for tool sequences
- Run as a CLI tool in CI like `vitest` or `pytest`

You still need to:
- Manually generate test datasets
- Replay logged traces from production
- Write custom scripts for each scenario

### Agent Frameworks (LangChain, CrewAI, AutoGen)

**What they're great at:**
- Building agents with tools and prompts
- Managing conversation state
- Orchestrating multi-agent systems

**What they don't do:**
- Provide a built-in test runner
- Simulate realistic users
- Evaluate agent quality automatically

Testing means writing one-off scripts for every scenario and manually inspecting outputs.

## The Agentest Solution

Agentest fills the gap with a **test runner designed specifically for agents**:

```
┌─ You define: persona + goal + knowledge + tool mocks + assertions
│
├─ Agentest creates a simulated user (LLM) that talks to your agent
│
├─ Tool calls are intercepted and resolved through your mocks
│  (check_availability → { slots: ['09:00', '10:30'] })
│  (create_booking → { success: true, bookingId: 'BK-001' })
│
├─ Trajectory assertions verify the agent called the right tools
│  (matchMode: 'contains', expected: [check_availability, create_booking])
│
└─ LLM-as-judge evaluates every turn: helpfulness, coherence, goal completion
```

### Key Differentiators

1. **Simulated Users** — LLM-powered personas with goals that generate realistic conversations
2. **Tool Mocking** — Intercept and control tool calls without modifying agent code
3. **Trajectory Assertions** — Deterministic verification of tool call sequences
4. **Scenario-Based** — Write `.sim.ts` files like Vitest tests
5. **CI-Ready** — Exit codes, reporters, watch mode

## When to Use Agentest

Use Agentest when you need to:

✅ Test multi-turn agent conversations in CI
✅ Verify tool call sequences and logic
✅ Catch regressions before deploying
✅ Compare different models or configurations
✅ Simulate edge cases and error scenarios
✅ Evaluate agent quality automatically

## When to Use Other Tools

### Use DeepEval when:
- You have existing datasets of input/output pairs
- You need a wide library of specialized metrics
- Python is your primary language

### Use LangSmith/Langfuse when:
- You need production observability
- You want to collect user feedback
- You need dataset annotation UI
- You're building a feedback loop from production to development

## Complementary, Not Competitive

Agentest complements eval platforms and observability tools:

```
Development → CI → Production → Feedback Loop
    ↓          ↓         ↓            ↓
  Write    Agentest   LangSmith/  Back to
  Code      Tests    Langfuse    Development
                    Observability
```

**Development & CI:**
- Write `.sim.ts` scenario files
- Run `npx agentest run` in CI
- Catch regressions before deploy

**Production:**
- Use LangSmith/Langfuse for tracing
- Collect user feedback
- Analyze real-world behavior

**Feedback Loop:**
- Export production traces as test scenarios
- Run in Agentest to verify fixes
- Deploy with confidence

## Next Steps

- [Get Started](/guide/getting-started) - Install and run your first test
- [How It Works](/guide/how-it-works) - Understand the execution model
- [Configuration](/guide/configuration) - Configure your agent tests
