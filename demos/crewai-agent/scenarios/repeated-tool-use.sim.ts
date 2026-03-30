import { scenario } from '@agentesting/agentest'

// Tests that the agent calls get_weather multiple times with different city args.
scenario('repeated tool: weather for three cities', {
  profile: 'A traveler comparing weather across cities',
  goal: 'Use the weather tool to check Paris, Tokyo, and Sydney. Tell me which is warmest.',

  maxTurns: 2,

  mocks: {
    tools: {
      get_weather: (args) => {
        const city = (args as { city: string }).city.toLowerCase()
        const data: Record<string, string> = {
          paris: 'Paris: 68°F, Sunny',
          tokyo: 'Tokyo: 72°F, Clear',
          sydney: 'Sydney: 78°F, Warm and humid',
        }
        return data[city] ?? `${args.city}: 65°F, Mild`
      },
      calculator: () => '0',
      web_search: () => 'No results.',
      read_file: () => 'Error: not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'get_weather', argMatchMode: 'ignore' },
        { name: 'get_weather', argMatchMode: 'ignore' },
        { name: 'get_weather', argMatchMode: 'ignore' },
      ],
      forbidden: [{ name: 'web_search' }],
    },
  },
})
