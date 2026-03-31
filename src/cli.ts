#!/usr/bin/env node

import { Command } from 'commander'
import path from 'node:path'
import { readFile, access } from 'node:fs/promises'
import { watch, readFileSync, type FSWatcher } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { parse as parseYaml } from 'yaml'
import { defineConfig } from './config/defineConfig.js'
import type { AgentestConfig, AgentestConfigInput } from './config/schema.js'
import { discoverAndLoad } from './runner/discovery.js'
import { Runner } from './runner/runner.js'
import { ConsoleReporter } from './runner/reporters/console.js'
import { JsonReporter } from './runner/reporters/json.js'
import { GitHubActionsReporter } from './runner/reporters/githubActions.js'
import type { Reporter } from './runner/reporters/types.js'
import * as prompts from './evaluator/prompts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')) as {
  version: string
}

const program = new Command()

program.name('agentest').description('Agent simulation & evaluation framework').version(pkg.version)

program
  .command('run')
  .description('Run agent simulations')
  .option('-c, --config <path>', 'Path to config file')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .option('--scenario <name>', 'Run only scenarios matching this name')
  .option('--verbose', 'Print full conversation transcripts')
  .option('-w, --watch', 'Watch for file changes and re-run')
  .action(
    async (opts: {
      config?: string
      cwd: string
      scenario?: string
      verbose?: boolean
      watch?: boolean
    }) => {
      const configPath = await resolveConfigPath(opts.cwd, opts.config)

      const executeRun = async () => {
        const config = await loadConfig(configPath, opts.cwd)
        const discoveries = await discoverAndLoad(config, opts.cwd)

        // Filter by scenario name if specified
        if (opts.scenario) {
          for (const d of discoveries) {
            d.scenarios = d.scenarios.filter((s) =>
              s.name.toLowerCase().includes(opts.scenario!.toLowerCase()),
            )
          }
        }

        const totalScenarios = discoveries.reduce((sum, d) => sum + d.scenarios.length, 0)

        if (totalScenarios === 0) {
          console.error('No scenarios found. Check your include/exclude patterns.')
          if (!opts.watch) process.exit(1)
          return false
        }

        const reporters = createReporters(config, opts.verbose)
        const runner = new Runner(config, reporters)

        const isComparison = config.compare && config.compare.length > 0
        if (isComparison) {
          const result = await runner.runComparison(discoveries)
          return result.passed
        } else {
          const result = await runner.run(discoveries)
          return result.passed
        }
      }

      if (!opts.watch) {
        const passed = await executeRun()
        process.exit(passed ? 0 : 1)
      }

      // Watch mode
      await executeRun()
      console.log('\n\x1b[2mWatching for changes... (press Ctrl+C to stop)\x1b[0m\n')

      const absConfigPath = path.resolve(opts.cwd, configPath)
      const watchDirs = new Set<string>()
      watchDirs.add(path.dirname(absConfigPath))
      watchDirs.add(opts.cwd)

      const watchers: FSWatcher[] = []
      let debounceTimer: ReturnType<typeof setTimeout> | null = null
      let running = false
      let pendingRerun = false

      const triggerRerun = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          if (running) {
            pendingRerun = true
            return
          }
          running = true
          console.clear()
          try {
            await executeRun()
          } catch (error) {
            console.error('Run failed:', error instanceof Error ? error.message : error)
          }
          running = false
          if (pendingRerun) {
            pendingRerun = false
            triggerRerun()
            return
          }
          console.log('\n\x1b[2mWatching for changes... (press Ctrl+C to stop)\x1b[0m\n')
        }, 300)
      }

      for (const dir of watchDirs) {
        try {
          const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
            if (!filename) return
            // Only react to relevant files
            if (
              filename.endsWith('.sim.ts') ||
              filename.endsWith('.sim.js') ||
              filename.includes('agentest.config')
            ) {
              triggerRerun()
            }
          })
          watchers.push(watcher)
        } catch {
          // Directory might not exist, skip
        }
      }

      // Graceful shutdown
      const cleanup = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        for (const w of watchers) w.close()
        process.exit(0)
      }
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
    },
  )

program
  .command('show-prompts')
  .description('Print all evaluation prompt templates')
  .option('--metric <name>', 'Show only a specific metric prompt')
  .action((opts: { metric?: string }) => {
    const allPrompts: Record<string, string> = {
      helpfulness: prompts.HELPFULNESS_PROMPT,
      coherence: prompts.COHERENCE_PROMPT,
      relevance: prompts.RELEVANCE_PROMPT,
      faithfulness: prompts.FAITHFULNESS_PROMPT,
      verbosity: prompts.VERBOSITY_PROMPT,
      goal_completion: prompts.GOAL_COMPLETION_PROMPT,
      agent_behavior_failure: prompts.AGENT_BEHAVIOR_FAILURE_PROMPT,
      tool_call_behavior_failure: prompts.TOOL_CALL_BEHAVIOR_FAILURE_PROMPT,
      error_deduplication: prompts.ERROR_DEDUPLICATION_PROMPT,
    }

    if (opts.metric) {
      const prompt = allPrompts[opts.metric]
      if (!prompt) {
        console.error(
          `Unknown metric: "${opts.metric}". Available: ${Object.keys(allPrompts).join(', ')}`,
        )
        process.exit(1)
      }
      console.log(`\n=== ${opts.metric} ===\n`)
      console.log(prompt)
    } else {
      for (const [name, prompt] of Object.entries(allPrompts)) {
        console.log(`\n=== ${name} ===\n`)
        console.log(prompt)
        console.log()
      }
    }
  })

const YAML_EXTENSIONS = ['.yaml', '.yml']
const CONFIG_CANDIDATES = ['agentest.config.ts', 'agentest.config.yaml', 'agentest.config.yml']

program.parse()

async function resolveConfigPath(cwd: string, explicit?: string): Promise<string> {
  if (explicit) return explicit

  for (const candidate of CONFIG_CANDIDATES) {
    const absPath = path.resolve(cwd, candidate)
    try {
      await access(absPath)
      return candidate
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    `No config file found. Looked for: ${CONFIG_CANDIDATES.join(', ')}\n` +
      `Create one or specify a path with --config`,
  )
}

async function loadConfig(configPath: string, cwd: string): Promise<AgentestConfig> {
  const absPath = path.resolve(cwd, configPath)
  const ext = path.extname(absPath).toLowerCase()

  try {
    if (YAML_EXTENSIONS.includes(ext)) {
      const content = await readFile(absPath, 'utf-8')
      const raw = parseYaml(content) as Record<string, unknown>
      return defineConfig(raw)
    }

    const { readTsconfigAliases } = await import('./runner/discovery.js')
    const alias = readTsconfigAliases(cwd)
    const jiti = createJiti(import.meta.url, { interopDefault: true, alias })
    const mod = (await jiti.import(absPath)) as {
      default?: AgentestConfig | AgentestConfigInput
    } & (AgentestConfig | AgentestConfigInput)
    const config = mod.default ?? mod
    return defineConfig(config as AgentestConfigInput)
  } catch (error) {
    console.error(`Failed to load config from ${absPath}:`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
    throw new Error('unreachable')
  }
}

function createReporters(config: AgentestConfig, verbose?: boolean): Reporter[] {
  const reporters: Reporter[] = []

  for (const name of config.reporters) {
    switch (name) {
      case 'console':
        reporters.push(new ConsoleReporter(config.thresholds, verbose))
        break
      case 'json':
        reporters.push(new JsonReporter())
        break
      case 'github-actions':
        reporters.push(new GitHubActionsReporter(config.thresholds))
        break
      default: {
        const _exhaustive: never = name
        console.warn(`[agentest] Unknown reporter: ${_exhaustive}`)
      }
    }
  }

  if (reporters.length === 0) {
    reporters.push(new ConsoleReporter(config.thresholds, verbose))
  }

  return reporters
}
