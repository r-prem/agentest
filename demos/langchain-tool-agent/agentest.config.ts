import 'dotenv/config'
import { defineConfig } from '@agentesting/agentest'
import { ChatOpenAI } from '@langchain/openai'
import { calculator } from './src/tools/calculator.js'
import { getWeather } from './src/tools/weather.js'
import { readFile } from './src/tools/fileReader.js'
import { webSearch } from './src/tools/search.js'

const tools = [calculator, getWeather, readFile, webSearch]

const model = new ChatOpenAI({
  model: 'gpt-5.4',
  temperature: 0.2,
}).bindTools(tools)

const systemMessage = {
  role: 'system',
  content:
    'You are a helpful assistant. You MUST use the available tools to answer questions. ' +
    'Never guess or make up information — always call the appropriate tool. ' +
    'For weather questions, use get_weather. For math, use calculator. ' +
    'For file contents, use read_file. For web lookups, use web_search.',
}

export default defineConfig({
  agent: {
    type: 'custom',
    name: 'langchain-tool-agent',
    handler: async (messages) => {
      const result = await model.invoke([systemMessage, ...messages])

      const toolCalls = result.tool_calls?.map((tc, i) => ({
        id: `call_${Date.now()}_${i}`,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      }))

      return {
        role: 'assistant' as const,
        content: (result.content as string) || '',
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
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
