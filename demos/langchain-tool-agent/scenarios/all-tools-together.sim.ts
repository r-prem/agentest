import { scenario } from '@agentesting/agentest'

// Tests that the agent can use all 4 tools in a single turn.
scenario('all tools: trip planning requires everything', {
  profile: 'A trip planner who needs 4 things done at once',
  goal: "Check weather in New York, search for 'NYC attractions', read ./budget.txt, and calculate 5 times 200. Report all results.",

  maxTurns: 2,

  knowledge: [{ content: 'Budget file is at ./budget.txt' }],

  mocks: {
    tools: {
      get_weather: () => 'New York: 62°F, Partly cloudy',
      web_search: () => '1. Top NYC Attractions\n   Statue of Liberty, Central Park, Times Square.',
      read_file: () => 'Monthly budget: $3000\nTravel allocation: $1500',
      calculator: () => '1000',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'get_weather', argMatchMode: 'ignore' },
        { name: 'web_search', argMatchMode: 'ignore' },
        { name: 'read_file', argMatchMode: 'ignore' },
        { name: 'calculator', argMatchMode: 'ignore' },
      ],
    },
  },
})
