import { scenario } from '@agentesting/agentest'

// Tests EXACT argument matching: the agent must call calculator with precisely these args.
scenario('exact args: multiply 7 by 8', {
  profile: 'A student who needs a specific calculation done',
  goal: 'What is 7 times 8?',

  mocks: {
    tools: {
      calculator: () => '56',
      get_weather: () => 'Not available',
      web_search: () => 'No results.',
      read_file: () => 'Error: not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        {
          name: 'calculator',
          args: { a: 7, b: 8, operation: 'multiply' },
          argMatchMode: 'exact',
        },
      ],
    },
  },
})
