import { defineConfig } from 'tsup'

export default defineConfig([
  // Library entry points — dual CJS/ESM
  {
    entry: {
      index: 'src/index.ts',
      vitest: 'src/vitest.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
    outDir: 'dist',
    // Shim import.meta.url for CJS output (used by jiti's createJiti)
    shims: true,
  },
  // CLI — ESM only (runs via #!/usr/bin/env node)
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    sourcemap: true,
    outDir: 'dist',
  },
])
