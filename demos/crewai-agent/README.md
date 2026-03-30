# CrewAI Agent Demo

A complete example showing how to use **agentest** to test a [CrewAI](https://docs.crewai.com/) agent. Since CrewAI is Python, this demo uses an **HTTP endpoint** — the agent runs as a FastAPI server that speaks the OpenAI chat completions format.

## What's in this demo

- A CrewAI agent with 4 tools: calculator, weather, file reader, web search
- A FastAPI server that wraps the agent in an OpenAI-compatible endpoint
- 24 scenario files covering tool usage, edge cases, error handling, and trajectory assertions
- An `agentest.config.ts` that points at the running server

## Setup

```bash
cd demos/crewai-agent

# Python dependencies
pip install -r requirements.txt

# Node dependencies (for agentest)
npm install

cp .env.example .env
# Add your OpenAI API key to .env
```

## Run scenarios

Start the agent server first, then run agentest:

```bash
# Terminal 1: start the CrewAI server
npm run serve
# → Agent server running on http://localhost:8123/api/chat

# Terminal 2: run scenarios
npm run sim
```

## How the HTTP integration works

CrewAI is Python, so it can't use a custom handler directly. Instead, the agent is wrapped in a FastAPI server that accepts the standard chat completions format:

```python
# server.py
@app.post("/api/chat")
async def chat(request: ChatRequest):
    task = Task(description=user_input, agent=agent, ...)
    crew = Crew(agents=[agent], tasks=[task])
    result = crew.kickoff()
    return {"choices": [{"message": {"role": "assistant", "content": str(result)}}]}
```

Then agentest points at it:

```ts
// agentest.config.ts
export default defineConfig({
  agent: {
    name: 'crewai-agent',
    endpoint: 'http://localhost:8123/api/chat',
  },
})
```

This pattern works for **any** Python framework — CrewAI, AutoGen, LlamaIndex, Haystack, etc.

## Project structure

```
agentest.config.ts   # agentest config pointing at the server
scenarios/           # 24 scenario files (.sim.ts)
requirements.txt     # Python dependencies
src/
  server.py          # FastAPI server wrapping the CrewAI agent
  agent.py           # CrewAI agent definition
  tools/             # Tool definitions using crewai's @tool decorator
```
