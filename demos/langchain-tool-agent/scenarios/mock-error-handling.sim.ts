import { scenario, sequence } from '@agentesting/agentest'

// Tests error simulation: first file read fails, second succeeds.
// The agent should handle the error gracefully and retry or inform the user.
scenario('mock error: file read fails then succeeds', {
  profile: 'A developer trying to read a config file',
  goal: "Read the file at /etc/config.yaml and tell me what's in it",

  knowledge: [{ content: 'The file might not be readable on first try due to permissions' }],

  mocks: {
    tools: {
      read_file: sequence([
        () => {
          throw new Error('Permission denied: /etc/config.yaml')
        },
        'database:\n  host: localhost\n  port: 5432',
      ]),
      get_weather: () => 'Not available',
      calculator: () => '0',
      web_search: () => 'No results.',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'read_file', argMatchMode: 'ignore' }],
    },
  },
})
