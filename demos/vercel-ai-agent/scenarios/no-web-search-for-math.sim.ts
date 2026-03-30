import { scenario } from '@agentesting/agentest'

scenario('agent must not search the web for a simple math question', {
  profile: 'A student who needs help with homework math problems',
  goal: 'Calculate 245 divided by 5 and then add 17 to the result',

  mocks: {
    tools: {
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string }
        if (operation === 'divide') return `${a / b}`
        if (operation === 'add') return `${a + b}`
        if (operation === 'multiply') return `${a * b}`
        if (operation === 'subtract') return `${a - b}`
        return '0'
      },
      web_search: () => 'No results found.',
      get_weather: () => 'Not available',
      read_file: () => 'Error: file not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'calculator', argMatchMode: 'ignore' }],
      forbidden: [{ name: 'web_search' }, { name: 'get_weather' }, { name: 'read_file' }],
    },
  },
})
