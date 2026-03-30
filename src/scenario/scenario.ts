import type { Scenario, ScenarioOptions } from './types.js'
import { validateScenarioOptions } from './types.js'

const scenarioRegistry: Scenario[] = []

export function scenario(name: string, options: ScenarioOptions): Scenario {
  validateScenarioOptions(options)
  const s: Scenario = { name, options }
  scenarioRegistry.push(s)
  return s
}

export function getRegisteredScenarios(): Scenario[] {
  return [...scenarioRegistry]
}

export function clearScenarioRegistry(): void {
  scenarioRegistry.length = 0
}
