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
        throw new Error(`Environment variable "${envVar}" is not set (referenced in header "${key}")`)
      }
      return envValue
    })
  }
  return result
}

export function defineConfig(input: AgentestConfigInput): AgentestConfig {
  const config = configSchema.parse(input)

  if (config.agent.type !== 'custom' && config.agent.headers) {
    return {
      ...config,
      agent: { ...config.agent, headers: interpolateEnvVars(config.agent.headers) },
      compare: config.compare?.map((entry) =>
        'headers' in entry && entry.headers
          ? { ...entry, headers: interpolateEnvVars(entry.headers) }
          : entry,
      ),
    }
  }

  if (config.compare) {
    return {
      ...config,
      compare: config.compare.map((entry) =>
        'headers' in entry && entry.headers
          ? { ...entry, headers: interpolateEnvVars(entry.headers) }
          : entry,
      ),
    }
  }

  return config
}
