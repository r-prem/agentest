# Vercel AI SDK Agent Demo

A complete example showing how to use **agentest** to test an agent built with the [Vercel AI SDK](https://sdk.vercel.ai/) (`ai` package). Uses a **custom handler** — no HTTP server needed.

## What's in this demo

- An agent using `generateText()` from the Vercel AI SDK with 4 tools: calculator, weather, file reader, web search
- 24 scenario files covering tool usage, edge cases, error handling, and trajectory assertions
- An `agentest.config.ts` that wires the agent via a custom handler

## Setup

```bash
cd demos/vercel-ai-agent
npm install
cp .env.example .env
# Add your OpenAI API key to .env
```

## Run scenarios

```bash
npm run sim
```

## How the custom handler works

The config calls `generateText()` directly with `maxSteps: 1` so agentest controls the tool loop:

```ts
export default defineConfig({
  agent: {
    type: 'custom',
    name: 'vercel-ai-agent',
    handler: async (messages) => {
      const { text, toolCalls } = await generateText({
        model: openai('gpt-4o'),
        tools,
        messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
        maxSteps: 1, // let agentest handle the tool loop
      })
      // ... map toolCalls to OpenAI format and return
    },
  },
})
```

Setting `maxSteps: 1` is important — it prevents the AI SDK from executing tools itself, letting agentest intercept tool calls and apply mocks.

## Project structure

```
agentest.config.ts   # agentest config with custom handler
scenarios/           # 24 scenario files (.sim.ts)
src/
  index.ts           # CLI entry point (standalone usage)
  tools/             # Tool definitions using ai's tool()
```

## Running the agent standalone

```bash
npm start
# or with a custom query:
npm start -- "What's the weather in Tokyo?"
```
