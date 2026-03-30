import 'dotenv/config'
import { defineConfig } from '@agentesting/agentest'

export default defineConfig({
  agent: {
    name: 'crewai-agent',
    endpoint: 'http://localhost:8123/api/chat',
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
