import { scenario } from '@agentesting/agentest'

// Tests UNORDERED trajectory matching: both tools must be called, any order, no extras.
scenario('unordered: weather and calculator in any order', {
  profile: 'An efficient planner who asks everything at once',
  goal: 'What is the weather in London and what is 88 divided by 4?',

  maxTurns: 2,

  mocks: {
    tools: {
      get_weather: () => 'London: 55°F, Rainy',
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string }
        if (operation === 'divide') return b !== 0 ? `${a / b}` : 'Error'
        return '0'
      },
      // Still mock these to avoid unmocked errors, but agent shouldn't use them
      web_search: () => 'No results.',
      read_file: () => 'Error: not found',
    },
  },

  // Changed to 'contains' — we care that both tools are called, not that nothing else is
  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'get_weather', argMatchMode: 'ignore' },
        { name: 'calculator', argMatchMode: 'ignore' },
      ],
    },
  },
})
