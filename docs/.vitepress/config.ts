import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Agentest',
  description: 'Embedded agent simulation & evaluation framework for Node.js/TypeScript',
  base: '/',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'Examples', link: '/examples/basic-scenario' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Agentest?', link: '/guide/what-is-agentest' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Why Agentest?', link: '/guide/why-agentest' },
            { text: 'How It Works', link: '/guide/how-it-works' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Scenarios', link: '/guide/scenarios' },
            { text: 'Mocks', link: '/guide/mocks' },
            { text: 'Trajectory Assertions', link: '/guide/trajectory-assertions' },
            { text: 'Evaluation Metrics', link: '/guide/evaluation-metrics' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom Metrics', link: '/guide/custom-metrics' },
            { text: 'Comparison Mode', link: '/guide/comparison-mode' },
            { text: 'Framework Integration', link: '/guide/framework-integration' },
            { text: 'Vitest Integration', link: '/guide/vitest-integration' },
            { text: 'Local LLMs', link: '/guide/local-llms' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Configuration API', link: '/reference/config-api' },
            { text: 'Scenario API', link: '/reference/scenario-api' },
            { text: 'Metrics API', link: '/reference/metrics-api' },
            { text: 'CLI Reference', link: '/reference/cli' },
          ],
        },
        {
          text: 'Types',
          items: [
            { text: 'Type Definitions', link: '/reference/types' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Scenario', link: '/examples/basic-scenario' },
            { text: 'Error Handling', link: '/examples/error-handling' },
            { text: 'Multi-turn Conversations', link: '/examples/multi-turn' },
            { text: 'Custom Handler', link: '/examples/custom-handler' },
            { text: 'Tool Call Sequences', link: '/examples/tool-sequences' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/agentest' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },
})
