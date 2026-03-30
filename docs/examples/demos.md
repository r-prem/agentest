# Demos

Complete, runnable demo projects showing how to use Agentest with different agent frameworks. Each demo includes an agent with 4 tools (calculator, weather, file reader, web search) and 24 scenario files.

## Available Demos

### [LangChain Tool Agent](https://github.com/r-prem/agentest/tree/master/demos/langchain-tool-agent)

- **Framework:** LangChain (`@langchain/openai`)
- **Integration:** Custom handler (TypeScript, in-process)
- **Key concept:** Wires a `ChatOpenAI` model directly into the agentest handler — no HTTP server needed

```bash
cd demos/langchain-tool-agent && npm install && cp .env.example .env
npm run sim
```

### [Vercel AI SDK Agent](https://github.com/r-prem/agentest/tree/master/demos/vercel-ai-agent)

- **Framework:** Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- **Integration:** Custom handler (TypeScript, in-process)
- **Key concept:** Uses `generateText()` with `maxSteps: 1` so agentest controls the tool loop

```bash
cd demos/vercel-ai-agent && npm install && cp .env.example .env
npm run sim
```

### [CrewAI Agent](https://github.com/r-prem/agentest/tree/master/demos/crewai-agent)

- **Framework:** CrewAI (Python)
- **Integration:** HTTP endpoint (FastAPI server)
- **Key concept:** Demonstrates the HTTP pattern for Python frameworks — wrap your agent in a FastAPI server that speaks the OpenAI chat completions format

```bash
# Terminal 1: start the Python server
cd demos/crewai-agent && pip install -r requirements.txt
npm run serve

# Terminal 2: run scenarios
cd demos/crewai-agent && npm install && cp .env.example .env
npm run sim
```

## What the demos cover

All three demos share the same 24 scenarios, covering:

- **Basic tool usage** — weather lookup, calculations, file reading, web search
- **Argument matching** — exact and partial argument assertions
- **Trajectory assertions** — strict, contains, unordered, and within match modes
- **Error handling** — division by zero, file read failures, impossible tasks
- **Mock features** — function mocks, sequence mocks, context-aware mocks
- **Evaluation** — faithfulness to tool results, verbosity, knowledge grounding

## Custom handler vs HTTP endpoint

| | Custom handler | HTTP endpoint |
|---|---|---|
| **When to use** | TypeScript/Node.js agents | Python or other languages |
| **Setup** | No server needed | Start server first, then run agentest |
| **Speed** | Faster (in-process) | Slightly slower (HTTP overhead) |
| **Examples** | LangChain, Vercel AI SDK | CrewAI, AutoGen, LlamaIndex |
