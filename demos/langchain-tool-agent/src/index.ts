import 'dotenv/config'
import { agent } from './agent.js'

async function main() {
  const query = process.argv[2] || "What's the weather in Paris? Also, what is 15 multiplied by 4?"

  console.log(`\nQuery: ${query}\n`)

  const result = await agent.invoke({
    messages: [{ role: 'user', content: query }],
  })

  console.log('Agent response:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
