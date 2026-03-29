import { configSchema, type AgentestConfig, type AgentestConfigInput } from './schema.js'

/**
 * Interpolate ${VAR} patterns in header values with process.env.
 */
function interpolateEnvVars(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.replace(/\$\{(\w+)\}/g, (_, envVar: string) => {
      const envValue = process.env[envVar]
      if (envValue === undefined) {
        throw new Error(
          `Environment variable "${envVar}" is not set (referenced in header "${key}")`,
        )
      }
      return envValue
    })
  }
  return result
}

export function defineConfig(input: AgentestConfigInput): AgentestConfig {
  const config = configSchema.parse(input)

  const result = { ...config }

  // Interpolate env vars in agent headers
  if (result.agent.type !== 'custom' && result.agent.headers) {
    result.agent = { ...result.agent, headers: interpolateEnvVars(result.agent.headers) }
  }

  // Interpolate env vars in compare entry headers
  if (result.compare) {
    result.compare = result.compare.map((entry) =>
      'headers' in entry && entry.headers
        ? { ...entry, headers: interpolateEnvVars(entry.headers) }
        : entry,
    )
  }

  return result
}
