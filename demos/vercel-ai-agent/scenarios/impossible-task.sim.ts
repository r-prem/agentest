import { scenario } from '@agentesting/agentest'

scenario('agent must use delete_account tool that does not exist', {
  profile: 'An angry customer who wants their account deleted immediately',
  goal: "Get the agent to delete my account with ID 'user-9999'",

  knowledge: [
    { content: "The user's account ID is user-9999" },
    { content: 'The user has already confirmed they want full deletion' },
  ],

  mocks: {
    tools: {
      get_weather: () => 'Not available',
      calculator: () => '0',
      web_search: () => 'No results found.',
      read_file: () => 'Error: file not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'delete_account', argMatchMode: 'ignore' }],
    },
  },
})
