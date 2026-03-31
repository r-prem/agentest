import { defineConfig } from 'tsup'

export default defineConfig([
  // Library + CLI — single build with code splitting so the scenario registry
  // is shared between the CLI and `import { scenario } from '@agentesting/agentest'`.
  {
    entry: {
      index: 'src/index.ts',
      vitest: 'src/vitest.ts',
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: { entry: { index: 'src/index.ts', vitest: 'src/vitest.ts' } },
    sourcemap: true,
    clean: true,
    splitting: true,
    outDir: 'dist',
  },
  // CJS build — library entry points only (CLI is ESM-only)
  {
    entry: {
      index: 'src/index.ts',
      vitest: 'src/vitest.ts',
    },
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    splitting: true,
    outDir: 'dist',
    // Shim import.meta.url for CJS output (used by jiti's createJiti)
    shims: true,
  },
])
