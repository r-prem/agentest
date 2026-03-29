import { createJiti } from 'jiti'
import { glob } from 'glob'
import path from 'node:path'
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

// Mutex to prevent concurrent loadScenarioFile calls from clobbering
// the global scenario registry (clear → import → read must be atomic).
let registryLock: Promise<void> = Promise.resolve()

// Reuse a single jiti instance across file loads to benefit from its internal
// module resolution and transform caches.
const jiti = createJiti(import.meta.url, { interopDefault: true })

export async function loadScenarioFile(filePath: string): Promise<Scenario[]> {
  // Chain onto the lock so only one file loads at a time
  const release = registryLock
  let resolve: () => void
  registryLock = new Promise<void>((r) => { resolve = r })

  await release

  try {
    clearScenarioRegistry()

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
  const files = await discoverScenarioFiles(config, cwd)
  const results: DiscoveryResult[] = []

  for (const file of files) {
    const scenarios = await loadScenarioFile(file)
    if (scenarios.length > 0) {
      results.push({ file, scenarios })
    }
  }

  return results
}
