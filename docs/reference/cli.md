# CLI Reference

Complete reference for all Agentest CLI commands and options.

## Commands

### `agentest run`

Run all scenarios or filter by name.

```bash
npx agentest run [options]
```

**Options:**

| Option | Alias | Description |
|--------|-------|-------------|
| `--config <path>` | `-c` | Path to config file (default: auto-detect) |
| `--cwd <path>` | | Working directory (default: current directory) |
| `--scenario <name>` | `-s` | Filter scenarios by name (case-insensitive substring match) |
| `--verbose` | `-v` | Print full conversation transcripts |
| `--watch` | `-w` | Watch mode — re-run on file changes |

**Examples:**

```bash
# Run all scenarios
npx agentest run

# Custom config file (TypeScript or YAML)
npx agentest run --config path/to/config.ts
npx agentest run --config agentest.config.yaml

# Different working directory
npx agentest run --cwd ./packages/my-agent

# Filter scenarios by name
npx agentest run --scenario "booking"
npx agentest run --scenario "cancel"

# Print full conversation transcripts
npx agentest run --verbose

# Watch mode
npx agentest run --watch
npx agentest run -w

# Combine flags
npx agentest run --watch --verbose --scenario "booking"
```

### `agentest show-prompts`

Inspect the LLM judge prompts used for evaluation.

```bash
npx agentest show-prompts [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--metric <name>` | Show a specific metric's prompt |

**Available metrics:**

- `helpfulness`
- `coherence`
- `relevance`
- `faithfulness`
- `verbosity`
- `goal_completion`
- `agent_behavior_failure`
- `tool_call_behavior_failure`
- `error_deduplication`

**Examples:**

```bash
# Show all prompts
npx agentest show-prompts

# Show a specific metric's prompt
npx agentest show-prompts --metric helpfulness
npx agentest show-prompts --metric agent_behavior_failure
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All scenarios passed |
| `1` | One or more scenarios failed, or no scenarios found |

Use exit codes in CI to fail builds on test failures:

```yaml
# GitHub Actions example
- name: Run agent tests
  run: npx agentest run
  # Fails the workflow if exit code is 1
```

## Watch Mode

Watch mode monitors:

- All `.sim.ts` and `.sim.js` scenario files
- The `agentest.config.*` config file

On any change, it clears the console, re-loads the config, re-discovers scenarios, and re-runs. Changes are debounced (300ms) to batch rapid saves.

```bash
npx agentest run --watch
```

Combine with other flags:

```bash
npx agentest run --watch --scenario "booking" --verbose
```

Press `Ctrl+C` to stop.

## Configuration Discovery

Agentest auto-detects configuration files in this order:

1. `agentest.config.ts`
2. `agentest.config.yaml`
3. `agentest.config.yml`

You can override with `--config`:

```bash
npx agentest run --config custom-config.ts
```

## Environment Variables

Agentest uses environment variables for:

1. **LLM provider API keys** (for simulated user and evaluation):
   - `ANTHROPIC_API_KEY` (default provider)
   - `OPENAI_API_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`

2. **Agent endpoint authentication** (interpolated in config):
   ```ts
   headers: {
     Authorization: 'Bearer ${AGENT_API_KEY}'
   }
   ```

Set them in your shell or CI environment:

```bash
export ANTHROPIC_API_KEY=your-key-here
export AGENT_API_KEY=your-agent-key
npx agentest run
```

## Reporters

Configure reporters in your config file:

```ts
export default defineConfig({
  reporters: ['console', 'json', 'github-actions'],
})
```

### Console Reporter (default)

Colored pass/fail output with:
- Live progress spinner during simulation/evaluation
- Per-conversation results
- Metric scores
- Unique error summaries
- Threshold violations

In non-TTY environments (CI), falls back to line-by-line progress output.

### JSON Reporter

Writes full results to `.agentest/results.json`:

```json
{
  "scenarios": [
    {
      "scenarioId": "...",
      "scenarioName": "user books a morning slot",
      "conversations": [...],
      "summary": {...}
    }
  ]
}
```

Useful for:
- Programmatic analysis
- Custom reporting
- CI integrations

### GitHub Actions Reporter

Writes markdown summary table to `$GITHUB_STEP_SUMMARY` and emits:
- `::error` annotations for critical failures
- `::warning` annotations for warnings
- `::notice` annotations for informational messages

Annotations surface inline on PRs.

## Next Steps

- [Configuration API](/reference/config-api) - Full configuration reference
- [Scenario API](/reference/scenario-api) - Scenario definition reference
- [Metrics API](/reference/metrics-api) - Custom metrics reference
