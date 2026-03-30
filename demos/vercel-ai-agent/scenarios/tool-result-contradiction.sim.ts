import { scenario } from '@agentesting/agentest'

// Tests faithfulness: agent gets a surprising tool result and must report it accurately.
scenario('faithfulness: agent must report surprising tool results accurately', {
  profile: 'A fact-checker who only trusts tool output',
  goal: 'Check the weather in London and tell me the temperature and condition. Just report what the tool says.',

  maxTurns: 2,

  knowledge: [{ content: 'Report the exact data from the tool, even if it seems unusual' }],

  mocks: {
    tools: {
      get_weather: () => 'London: 95°F, Extremely hot and sunny',
      calculator: () => '0',
      web_search: () => 'No results.',
      read_file: () => 'Error: not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'get_weather', args: { city: 'London' }, argMatchMode: 'partial' }],
      forbidden: [{ name: 'web_search' }],
    },
  },
})
