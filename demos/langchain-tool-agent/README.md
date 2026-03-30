# LangChain Tool Agent Demo

A complete example showing how to use **agentest** to test a LangChain-based agent with multiple tools. This demo uses a **custom handler** — no HTTP server needed. The agent runs in-process during evaluation.

## What's in this demo

- A LangChain agent with 4 tools: calculator, weather lookup, file reader, and web search
- 24 scenario files covering tool usage, edge cases, error handling, trajectory assertions, and more
- An `agentest.config.ts` that wires the agent directly via a custom handler

## Setup

```bash
cd demos/langchain-tool-agent
npm install
cp .env.example .env
# Add your OpenAI API key to .env
```

## Run scenarios

```bash
npm run sim
```

This executes all 24 scenarios in the `scenarios/` directory against the agent — no server to start, no endpoints to configure.

## How the custom handler works

Instead of pointing agentest at an HTTP endpoint, the config defines an inline `handler` function that calls the LangChain model directly:

```ts
// agentest.config.ts
export default defineConfig({
  agent: {
    type: "custom",
    name: "langchain-tool-agent",
    handler: async (messages) => {
      const result = await model.invoke([systemMessage, ...messages]);
      // ... format and return the response
    },
  },
  // ...
});
```

This is simpler, faster, and avoids the overhead of running a server during testing.

## Project structure

```
agentest.config.ts   # agentest config with custom handler
scenarios/           # 24 scenario files (.sim.ts)
src/
  agent.ts           # LangChain agent setup
  index.ts           # CLI entry point (for running the agent standalone)
  tools/             # Tool definitions (calculator, weather, file reader, search)
```

## Running the agent standalone

You can also run the agent outside of agentest:

```bash
npm start
# or with a custom query:
npm start -- "What's the weather in Tokyo?"
```
