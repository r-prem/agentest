# Framework Integration

Agentest works with any agent framework — either through an OpenAI-compatible HTTP endpoint or via a custom handler function. Your agent code doesn't need any modifications.

## No Integration Needed

If your agent already exposes an OpenAI-compatible chat completions endpoint, point Agentest at it directly:

| Framework / Service | How to Connect |
|---------------------|---------------|
| **OpenAI API** | Use the endpoint directly |
| **Azure OpenAI** | Use the Azure endpoint with auth headers |
| **LiteLLM Proxy** | Proxy any model behind an OpenAI-compatible endpoint |
| **OpenRouter** | Use the OpenRouter endpoint |
| **vLLM / llama.cpp / Ollama** | All expose OpenAI-compatible servers |
| **Vercel AI SDK** | Expose a route handler that returns the standard format |

```ts
// Any OpenAI-compatible endpoint — no custom handler needed
export default defineConfig({
  agent: {
    name: 'my-agent',
    endpoint: 'https://api.example.com/v1/chat/completions',
    headers: { Authorization: 'Bearer ${API_KEY}' },
    body: { model: 'gpt-4o' },
  },
})
```

Agentest POSTs `{ messages: [...] }` and expects `{ choices: [{ message: { content, tool_calls? } }] }` in return.

## Custom Handler

For agents that don't expose an OpenAI-compatible endpoint, use `type: 'custom'` with a handler function:

```ts
import { defineConfig, type ChatMessage } from 'agentest'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'my-agent',
    handler: async (messages: ChatMessage[]) => {
      // Call your agent however you want
      const result = await myAgent.chat(messages)
      return {
        role: 'assistant' as const,
        content: result.text,
        // Optional: include tool_calls if your agent uses tools
        // tool_calls: [{ id: '...', type: 'function', function: { name: '...', arguments: '...' } }]
      }
    },
  },
})
```

The handler receives the full message history and must return an assistant message. If the response includes `tool_calls`, Agentest runs them through mocks and calls your handler again — the same loop as with HTTP endpoints.

## Framework Examples

### LangChain / LangGraph

```ts
import { ChatOpenAI } from '@langchain/openai'
import { defineConfig, type ChatMessage } from 'agentest'

const model = new ChatOpenAI({ model: 'gpt-4o' })

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'langchain-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await model.invoke(
        messages.map((m) => ({ role: m.role, content: m.content })),
      )
      return { role: 'assistant' as const, content: response.content as string }
    },
  },
})
```

For LangGraph agents, call `graph.invoke()` in the handler and map the final state to a response:

```ts
import { StateGraph } from '@langchain/langgraph'
import { defineConfig, type ChatMessage } from 'agentest'

const graph = new StateGraph({ /* your graph definition */ })
const app = graph.compile()

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'langgraph-agent',
    handler: async (messages: ChatMessage[]) => {
      const result = await app.invoke({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
      const lastMessage = result.messages[result.messages.length - 1]
      return { role: 'assistant' as const, content: lastMessage.content }
    },
  },
})
```

### Anthropic Claude SDK

```ts
import Anthropic from '@anthropic-ai/sdk'
import { defineConfig, type ChatMessage } from 'agentest'

const client = new Anthropic()

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'claude-agent',
    handler: async (messages: ChatMessage[]) => {
      const systemMessage = messages.find((m) => m.role === 'system')
      const chatMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: chatMessages,
        system: systemMessage?.content,
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return { role: 'assistant' as const, content: text }
    },
  },
})
```

### Vercel AI SDK

```ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { defineConfig, type ChatMessage } from 'agentest'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'vercel-ai-agent',
    handler: async (messages: ChatMessage[]) => {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
      return { role: 'assistant' as const, content: text }
    },
  },
})
```

### Mastra

```ts
import { Agent } from '@mastra/core/agent'
import { defineConfig, type ChatMessage } from 'agentest'

const agent = new Agent({ /* your config */ })

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'mastra-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await agent.generate(messages)
      return { role: 'assistant' as const, content: response.text }
    },
  },
})
```

### Python Frameworks (CrewAI, AutoGen, LlamaIndex, Haystack)

Python-based frameworks need a thin HTTP layer. Wrap your agent in a FastAPI endpoint:

```python
# server.py
from fastapi import FastAPI
from crew import my_crew  # your CrewAI setup

app = FastAPI()

@app.post("/api/chat")
async def chat(request: dict):
    messages = request["messages"]
    result = my_crew.kickoff(inputs={"messages": messages})
    return {
        "choices": [{"message": {"role": "assistant", "content": str(result)}}]
    }
```

Then point Agentest at it:

```ts
export default defineConfig({
  agent: {
    name: 'crewai-agent',
    endpoint: 'http://localhost:8000/api/chat',
  },
})
```

This pattern works for **any** Python framework — CrewAI, AutoGen/AG2, LlamaIndex, Haystack, Pydantic AI, Semantic Kernel, etc. The key is to return the response in the OpenAI chat completions format.

### Tool Calls with Custom Handlers

If your agent uses tools, return `tool_calls` in the handler response so Agentest can intercept and mock them:

```ts
handler: async (messages: ChatMessage[]) => {
  const response = await myAgent.chat(messages)

  return {
    role: 'assistant' as const,
    content: response.text || null,
    tool_calls: response.toolCalls?.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    })),
  }
}
```

When Agentest resolves tool calls through mocks, it passes the results back in the next `messages` array as `role: 'tool'` messages. Your handler will be called again with those results included.

## Not Yet Supported

| Protocol | Status |
|----------|--------|
| **MCP (Model Context Protocol)** | Not yet — MCP servers provide tools, not a chat interface |
| **A2A (Agent-to-Agent)** | Planned for a future release |

## Next Steps

- [Configuration](/guide/configuration) — Agent config options
- [Custom Handler Example](/examples/custom-handler) — In-depth walkthrough
- [Comparison Mode](/guide/comparison-mode) — Compare different frameworks side-by-side
