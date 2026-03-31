import { createJiti } from 'jiti'
import { glob } from 'glob'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { clearScenarioRegistry, getRegisteredScenarios } from '../scenario/scenario.js'
import type { Scenario } from '../scenario/types.js'
import type { AgentestConfig } from '../config/schema.js'

export interface DiscoveryResult {
  file: string
  scenarios: Scenario[]
}

export async function discoverScenarioFiles(
  config: AgentestConfig,
  cwd: string = process.cwd(),
): Promise<string[]> {
  const files = new Set<string>()

  for (const pattern of config.include) {
    const matches = await glob(pattern, {
      cwd,
      ignore: config.exclude,
      absolute: true,
    })
    for (const match of matches) {
      files.add(match)
    }
  }

  return [...files].sort()
}

/**
 * Read tsconfig.json paths and convert them to jiti aliases.
 * Maps `"@foo": ["src/foo/index.ts"]` → `{ "@foo": "<cwd>/src/foo/index.ts" }`
 */
export function readTsconfigAliases(cwd: string): Record<string, string> {
  const alias: Record<string, string> = {}
  try {
    const raw = readFileSync(path.join(cwd, 'tsconfig.json'), 'utf-8')
    // Strip single-line comments (// ...) so JSON.parse succeeds on tsconfig
    const stripped = raw.replace(/\/\/.*$/gm, '')
    const tsconfig = JSON.parse(stripped)
    const paths: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {}
    const baseUrl = tsconfig?.compilerOptions?.baseUrl ?? '.'
    const base = path.resolve(cwd, baseUrl)
    for (const [key, targets] of Object.entries(paths)) {
      if (targets.length > 0) {
        // Strip trailing /* for wildcard paths
        const cleanKey = key.replace(/\/\*$/, '')
        const cleanTarget = targets[0].replace(/\/\*$/, '')
        alias[cleanKey] = path.resolve(base, cleanTarget)
      }
    }
  } catch {
    // No tsconfig or parse error — skip silently
  }
  return alias
}

// Mutex to prevent concurrent loadScenarioFile calls from clobbering
// the global scenario registry (clear → import → read must be atomic).
let registryLock: Promise<void> = Promise.resolve()

// Lazily initialized jiti instance — needs cwd for tsconfig alias resolution.
let _jiti: ReturnType<typeof createJiti> | null = null

function getJiti(cwd: string): ReturnType<typeof createJiti> {
  if (!_jiti) {
    const alias = readTsconfigAliases(cwd)
    _jiti = createJiti(import.meta.url, { interopDefault: true, alias })
  }
  return _jiti
}

export async function loadScenarioFile(
  filePath: string,
  cwd: string = process.cwd(),
): Promise<Scenario[]> {
  // Chain onto the lock so only one file loads at a time
  const release = registryLock
  let resolve: () => void
  registryLock = new Promise<void>((r) => {
    resolve = r
  })

  await release

  try {
    clearScenarioRegistry()

    const jiti = getJiti(cwd)
    await jiti.import(filePath)

    return getRegisteredScenarios()
  } finally {
    resolve!()
  }
}

export async function discoverAndLoad(
  config: AgentestConfig,
  cwd?: string,
): Promise<DiscoveryResult[]> {
  const resolvedCwd = cwd ?? process.cwd()
  const files = await discoverScenarioFiles(config, resolvedCwd)
  const results: DiscoveryResult[] = []

  for (const file of files) {
    const scenarios = await loadScenarioFile(file, resolvedCwd)
    if (scenarios.length > 0) {
      results.push({ file, scenarios })
    }
  }

  return results
}
