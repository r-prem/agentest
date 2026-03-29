# What is Agentest?

**Vitest for AI agents.** Scenario-based testing with simulated users, tool-call mocks, and LLM-as-judge evaluation. Lives in your project like Playwright. Run with `npx agentest run`.

Agentest spins up LLM-powered simulated users that talk to your agent, intercepts tool calls through mocks, and evaluates every turn with LLM-as-judge metrics — all without touching your agent's code.

## Features

| Feature | Description |
|---|---|
| **Scenario-based tests** | Define user personas, goals, and knowledge — Agentest generates realistic multi-turn conversations |
| **Tool-call mocks** | Intercept and control tool calls with functions, sequences, and error simulation |
| **Trajectory assertions** | Verify tool call order and arguments with `strict`, `contains`, `unordered`, and `within` match modes |
| **LLM-as-judge metrics** | Helpfulness, coherence, relevance, faithfulness, goal completion, behavior failure detection |
| **Comparison mode** | Run the same scenarios against multiple models/configs side-by-side |
| **CI-ready CLI** | Exit codes, JSON reporter, GitHub Actions annotations, watch mode |
| **Custom handler** | Bring any agent — HTTP endpoint or in-process function. Works with any framework |

## Why This Is Needed

**The problem: testing agents is not like testing regular APIs.**

Traditional API tests send a request and assert on the response. Agent tests need to handle multi-turn conversations where the agent decides which tools to call, in what order, with what arguments — and the "correct" output is subjective.

**How current tools fall short:**

- **Eval platforms** (DeepEval, LangSmith, Langfuse) are great at scoring outputs after the fact, but they don't *run* your agent through realistic conversations. You still need to manually generate test data or replay logged traces.
- **Agent frameworks** (LangChain, CrewAI) give you building blocks but no built-in test runner. Testing means writing custom scripts for every scenario.
- **No good CLI runner** exists that combines simulated users, tool mocking, trajectory assertions, and evaluation in a single `npx` command — the way Vitest does for unit tests.

**How Agentest works:**

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
└─ LLM-as-judge evaluates every turn: helpfulness, coherence, goal completion, ...
```

Agentest complements eval platforms and observability tools — it doesn't replace them. Use Agentest to *run* your agent through test scenarios in CI. Use LangSmith/Langfuse to *observe* your agent in production.

## Agentest vs. Other Tools

Agentest is a **test runner**, not an eval framework or observability platform. Here's how it compares:

| Capability | Agentest | DeepEval | LangSmith | Langfuse |
|---|---|---|---|---|
| **Primary purpose** | Test runner for agents | Eval framework for LLM outputs | Observability + eval platform | Observability + eval platform |
| **Simulated users** | Built-in (LLM-powered personas with goals) | -- | -- | -- |
| **Tool-call mocking** | Built-in (functions, sequences, error sim) | -- | -- | -- |
| **Trajectory assertions** | Built-in (strict/contains/unordered/within) | -- | -- | -- |
| **LLM-as-judge eval** | Built-in (8 metrics + custom) | Built-in (extensive metric library) | Built-in | Built-in |
| **Multi-turn conversation testing** | Native (agent loop with mock resolution) | Manual test case setup | Trace replay | Trace replay |
| **Comparison mode** | Built-in (side-by-side model comparison) | Experiment tracking | Experiment tracking | Experiment tracking |
| **CI/CLI integration** | `npx agentest run` with exit codes | `deepeval test run` | SDK-based | SDK-based |
| **Production observability** | -- | -- | Tracing, logging, monitoring | Tracing, logging, monitoring |
| **Dataset management** | -- | Built-in | Built-in | Built-in |
| **Annotation/feedback UI** | -- | -- | Built-in | Built-in |
| **Pricing** | Open source (MIT) | Open source + cloud | Freemium SaaS | Open source + cloud |
| **Language** | TypeScript/Node.js | Python | Python (primary) | Python/JS SDKs |

**When to use what:**

- **Agentest** — You want to write `.sim.ts` scenario files that test your agent end-to-end in CI, like writing Vitest tests. No manual test data, no trace replay.
- **DeepEval** — You have existing datasets of input/output pairs and want to evaluate LLM output quality with a wide library of metrics.
- **LangSmith / Langfuse** — You need production tracing, logging, user feedback collection, and dataset management alongside evaluation.

These tools are complementary. Run Agentest in CI to catch regressions before deploy. Use LangSmith/Langfuse to monitor and evaluate in production.
