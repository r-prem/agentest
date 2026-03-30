import { scenario } from '@agentesting/agentest'

// Tests chained tool use: agent needs multiple calculator calls to complete the task.
scenario('multi-step: chained calculations', {
  profile: 'An accountant who needs precise step-by-step calculations',
  goal: 'Calculate the total: (200 * 3) + (50 * 7). Show each step.',

  knowledge: [
    { content: 'Item A costs 200, quantity 3' },
    { content: 'Item B costs 50, quantity 7' },
  ],

  mocks: {
    tools: {
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string }
        if (operation === 'multiply') return `${a * b}`
        if (operation === 'add') return `${a + b}`
        if (operation === 'subtract') return `${a - b}`
        if (operation === 'divide') return b !== 0 ? `${a / b}` : 'Error'
        return '0'
      },
      get_weather: () => 'Not available',
      web_search: () => 'No results.',
      read_file: () => 'Error: not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [
        { name: 'calculator', argMatchMode: 'ignore' },
        { name: 'calculator', argMatchMode: 'ignore' },
      ],
      forbidden: [{ name: 'web_search' }, { name: 'get_weather' }, { name: 'read_file' }],
    },
  },
})
