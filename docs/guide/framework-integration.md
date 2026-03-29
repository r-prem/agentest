# Framework Integration

Use Agentest with any agent framework.

## LangChain / LangGraph

```ts
import { ChatOpenAI } from '@langchain/openai'
import { defineConfig, type ChatMessage } from 'agentest'

const model = new ChatOpenAI({ model: 'gpt-4o' })

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'langchain-agent',
    handler: async (messages: ChatMessage[]) => {
      const response = await model.invoke(messages)
      return { role: 'assistant', content: response.content as string }
    },
  },
})
```

## Vercel AI SDK

```ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'vercel-ai-agent',
    handler: async (messages) => {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        messages,
      })
      return { role: 'assistant', content: text }
    },
  },
})
```

## Python Frameworks (CrewAI, AutoGen)

Create a FastAPI wrapper:

```python
# server.py
from fastapi import FastAPI
from crew import my_crew

app = FastAPI()

@app.post("/api/chat")
async def chat(request: dict):
    result = my_crew.kickoff(inputs=request["messages"])
    return {
        "choices": [{"message": {"role": "assistant", "content": str(result)}}]
    }
```

Point Agentest at it:

```ts
export default defineConfig({
  agent: {
    name: 'crewai-agent',
    endpoint: 'http://localhost:8000/api/chat',
  },
})
```
