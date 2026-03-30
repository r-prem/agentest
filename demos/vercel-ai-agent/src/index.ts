import 'dotenv/config'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { calculator } from './tools/calculator.js'
import { getWeather } from './tools/weather.js'
import { readFile } from './tools/fileReader.js'
import { webSearch } from './tools/search.js'

async function main() {
  const query = process.argv[2] || "What's the weather in Paris? Also, what is 15 multiplied by 4?"

  console.log(`\nQuery: ${query}\n`)

  const result = await generateText({
    model: openai('gpt-4o'),
    tools: { calculator, get_weather: getWeather, read_file: readFile, web_search: webSearch },
    system:
      'You are a helpful assistant. Use the available tools to answer questions. ' +
      'Never guess or make up information — always call the appropriate tool.',
    prompt: query,
    maxSteps: 5,
  })

  console.log('Response:', result.text)
}

main().catch(console.error)
