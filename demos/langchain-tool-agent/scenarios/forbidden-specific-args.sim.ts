import { scenario } from '@agentesting/agentest'

// Tests forbidden assertions: agent must use web_search but must NOT use file/weather tools.
scenario('forbidden args: search only, no other tools', {
  profile: 'A student researching cybersecurity for a presentation',
  goal: "Search for 'cybersecurity best practices' and summarize the results",

  maxTurns: 2,

  mocks: {
    tools: {
      web_search: () =>
        '1. NIST Cybersecurity Framework\n   Guidelines for managing cyber risk.\n2. OWASP Top 10\n   Most critical web security risks.',
      get_weather: () => 'Not available',
      calculator: () => '0',
      read_file: () => 'Error: not found',
    },
  },

  assertions: {
    toolCalls: {
      matchMode: 'contains',
      expected: [{ name: 'web_search', argMatchMode: 'ignore' }],
      forbidden: [{ name: 'read_file' }, { name: 'get_weather' }],
    },
  },
})
