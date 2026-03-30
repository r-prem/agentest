import 'dotenv/config'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { defineConfig, type ChatMessage } from '@agentesting/agentest'
import { calculator } from './src/tools/calculator.js'
import { getWeather } from './src/tools/weather.js'
import { readFile } from './src/tools/fileReader.js'
import { webSearch } from './src/tools/search.js'

const tools = {
  calculator,
  get_weather: getWeather,
  read_file: readFile,
  web_search: webSearch,
}

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'vercel-ai-agent',
    handler: async (messages: ChatMessage[]) => {
      const { text, toolCalls } = await generateText({
        model: openai('gpt-4o'),
        tools,
        system:
          'You are a helpful assistant. You MUST use the available tools to answer questions. ' +
          'Never guess or make up information — always call the appropriate tool. ' +
          'For weather questions, use get_weather. For math, use calculator. ' +
          'For file contents, use read_file. For web lookups, use web_search.',
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content || '',
        })),
        maxSteps: 1,
      })

      const mappedToolCalls = toolCalls?.map((tc, i) => ({
        id: `call_${Date.now()}_${i}`,
        type: 'function' as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.args),
        },
      }))

      return {
        role: 'assistant' as const,
        content: text || '',
        ...(mappedToolCalls && mappedToolCalls.length > 0 ? { tool_calls: mappedToolCalls } : {}),
      }
    },
  },
  model: 'gpt-5.4-nano',
  provider: 'openai',
  conversationsPerScenario: 2,
  maxTurns: 6,
  thresholds: {
    helpfulness: 3.5,
    faithfulness: 3.5,
    coherence: 3.5,
    relevance: 3.5,
    verbosity: 3.0,
  },
  reporters: ['console'],
  unmockedTools: 'error',
  include: ['scenarios/**/*.sim.ts'],
})
