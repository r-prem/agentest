# Agentest Documentation

This directory contains the VitePress documentation for Agentest.

## Development

Start the development server:

```bash
npm run docs:dev
```

The docs will be available at `http://localhost:5173`

## Building

Build the static documentation:

```bash
npm run docs:build
```

Output will be in `docs/.vitepress/dist`

## Preview Production Build

Preview the built documentation:

```bash
npm run docs:preview
```

## Structure

```
docs/
├── .vitepress/
│   ├── config.ts          # VitePress configuration
│   ├── cache/             # Build cache (gitignored)
│   └── dist/              # Build output (gitignored)
├── public/
│   └── logo.svg           # Site logo
├── guide/
│   ├── getting-started.md
│   ├── how-it-works.md
│   ├── configuration.md
│   ├── scenarios.md
│   ├── mocks.md
│   ├── trajectory-assertions.md
│   ├── evaluation-metrics.md
│   ├── custom-metrics.md
│   ├── comparison-mode.md
│   ├── framework-integration.md
│   ├── vitest-integration.md
│   └── local-llms.md
├── reference/
│   ├── api.md
│   ├── config-api.md
│   ├── scenario-api.md
│   ├── metrics-api.md
│   ├── cli.md
│   └── types.md
├── examples/
│   ├── basic-scenario.md
│   ├── error-handling.md
│   ├── multi-turn.md
│   ├── custom-handler.md
│   └── tool-sequences.md
└── index.md               # Homepage
```

## Adding New Pages

1. Create a new `.md` file in the appropriate directory
2. Add the page to the sidebar in `docs/.vitepress/config.ts`
3. Link to it from other relevant pages

## Customization

Edit `docs/.vitepress/config.ts` to customize:

- Site title and description
- Navigation menu
- Sidebar structure
- Theme settings
- Search configuration
