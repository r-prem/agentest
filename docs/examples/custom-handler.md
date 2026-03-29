# Custom Handler Example

Use a custom handler to test agents without an HTTP endpoint.

## In-Process Agent

```ts
import { defineConfig, type ChatMessage } from 'agentest'
import { myAgent } from './src/agent.js'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'my-agent',
    handler: async (messages: ChatMessage[]) => {
      const result = await myAgent.chat(messages)
      return {
        role: 'assistant',
        content: result.text,
      }
    },
  },
})
```

## With Tool Calls

```ts
handler: async (messages: ChatMessage[]) => {
  const result = await myAgent.chat(messages)

  // Map tool calls to OpenAI format
  const toolCalls = result.toolCalls?.map((tc, i) => ({
    id: `call_${i}`,
    type: 'function' as const,
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.args),
    },
  }))

  return {
    role: 'assistant',
    content: result.text || '',
    tool_calls: toolCalls,
  }
}
```

## Anthropic SDK

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'claude-agent',
    handler: async (messages) => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        system: messages.find((m) => m.role === 'system')?.content,
      })

      const text = response.content[0].type === 'text'
        ? response.content[0].text
        : ''

      return { role: 'assistant', content: text }
    },
  },
})
```

## Benefits of Custom Handlers

1. **No HTTP server needed** - Test agents in-process
2. **Direct SDK access** - Use any LLM SDK
3. **Custom protocols** - Not limited to OpenAI format
4. **Framework integration** - Works with LangChain, Vercel AI, etc.
5. **Local development** - Faster iteration during development

## Testing Different Versions

```ts
import { agentV1, agentV2 } from './src/agents.js'

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'v1',
    handler: async (msgs) => agentV1.chat(msgs),
  },

  compare: [
    {
      type: 'custom',
      name: 'v2',
      handler: async (msgs) => agentV2.chat(msgs),
    },
  ],
})
```
