# Reporters

Reporters control how Agentest outputs test results. Configure multiple reporters to get different views of your test runs.

## Overview

Agentest provides three built-in reporters:

| Reporter | Output | Use Case |
|----------|--------|----------|
| `console` | Terminal with colors and live progress | Local development, watching tests |
| `json` | `.agentest/results.json` file | Programmatic analysis, custom tooling |
| `github-actions` | GitHub Actions summary and annotations | CI/CD integration, PR feedback |

Configure reporters in your config:

```ts
export default defineConfig({
  reporters: ['console', 'json'],
})
```

You can use multiple reporters simultaneously to get different views of the same test run.

## Console Reporter

The default reporter. Provides colored, human-readable output in the terminal.

### Features

- ✅ Live progress spinner showing current activity
- ✅ Pass/fail status for each scenario and conversation
- ✅ Metric scores and threshold violations
- ✅ Unique error summaries with severity levels
- ✅ Trajectory assertion failures
- ✅ Exit code for CI integration

### Output Format

```
Agentest running 2 scenario(s)

  ⠹ user books a morning slot → simulating conv-1-a3f8b2c1 turn 2/8 — calling agent

✓ user books a morning slot
  ✓ conv-1-a3f8b2c1 (2 turns, goal met, trajectory matched)
    helpfulness: 4.5, coherence: 5.0, relevance: 5.0
  ✓ conv-2-d9e1f4a7 (3 turns, goal met, trajectory matched)
    helpfulness: 4.2, coherence: 4.8, relevance: 5.0
  ✓ conv-3-e8f2g5h9 (2 turns, goal met, trajectory matched)
    helpfulness: 4.8, coherence: 5.0, relevance: 5.0

  Average scores:
    helpfulness: 4.5 (threshold: 3.5 ✓)
    coherence: 4.9
    relevance: 5.0

✗ user cancels booking
  ✗ conv-1-b4c5d6e7 (3 turns, goal NOT met, trajectory matched)
    helpfulness: 3.1, coherence: 4.0, relevance: 4.5
  ✓ conv-2-f7g8h9i0 (2 turns, goal met, trajectory matched)
    helpfulness: 4.0, coherence: 4.5, relevance: 5.0

  Average scores:
    helpfulness: 3.55 (threshold: 3.5 ✓)
    goal_completion: 0.5 (threshold: 0.8 ✗)

  Unique errors:
    [high] Agent Failed to Complete Cancellation (1 occurrence)
      Agent provided cancellation information but didn't actually cancel the booking.

FAILED
1/2 scenarios passed
```

### Live Progress

During simulation and evaluation, the console reporter shows a live spinner:

```
⠹ user books a morning slot → simulating conv-1-a3f8b2c1 turn 2/8 — calling agent
⠸ user books a morning slot → evaluating conv-1-a3f8b2c1 turn 2 — running metrics
```

This gives real-time feedback on what Agentest is doing.

### Non-TTY Mode

In non-TTY environments (CI), the spinner is disabled and progress is shown line-by-line:

```
Running scenario: user books a morning slot
  Simulating conv-1-a3f8b2c1 turn 1/8
  Simulating conv-1-a3f8b2c1 turn 2/8
  Evaluating conv-1-a3f8b2c1
  ...
```

### Verbose Mode

Add `--verbose` flag to see full conversation transcripts:

```bash
npx agentest run --verbose
```

Output includes:

```
✓ user books a morning slot
  ✓ conv-1-a3f8b2c1

    Turn 1:
      User: I'd like to book a haircut for next Tuesday morning.
      Agent: I can help you with that! Let me check our availability for Tuesday morning.
      Tool calls:
        - check_availability({ date: '2026-03-25' })
          → { available: true, slots: ['09:00', '09:45', '10:30'] }
      Agent: We have several slots available on Tuesday morning: 9:00 AM, 9:45 AM, and 10:30 AM. Which time works best for you?

    Turn 2:
      User: 9:00 AM would be perfect.
      Agent: Great! I'll book you for 9:00 AM on Tuesday, March 25th.
      Tool calls:
        - create_booking({ date: '2026-03-25', time: '09:00', service: 'haircut' })
          → { success: true, bookingId: 'BK-001', confirmationSent: true }
      Agent: All set! Your appointment is confirmed for Tuesday, March 25th at 9:00 AM. Confirmation email sent.

    Metrics:
      helpfulness: 4.5 — Directly addressed user's goal with specific, actionable steps
      coherence: 5.0 — Perfectly consistent throughout the conversation
      relevance: 5.0 — Every response was on-topic and goal-oriented
      goal_completion: 1 — Goal fully achieved
```

This is invaluable for debugging failing scenarios.

### Configuration

```ts
export default defineConfig({
  reporters: ['console'],
  // No additional options
})
```

The console reporter is included by default if you don't specify `reporters`.

## JSON Reporter

Writes complete test results to `.agentest/results.json` for programmatic analysis.

### Features

- ✅ Full conversation transcripts
- ✅ All metric scores with reasons
- ✅ Trajectory assertion results
- ✅ Error details and stack traces
- ✅ Timing information
- ✅ Deduplicated errors

### Output Location

```
.agentest/
└── results.json
```

The `.agentest/` directory is created in your working directory (where you run `npx agentest`).

### JSON Structure

```json
{
  "runId": "run-2026-03-29T10:30:00Z",
  "startedAt": "2026-03-29T10:30:00.000Z",
  "completedAt": "2026-03-29T10:32:15.432Z",
  "durationMs": 135432,
  "config": {
    "conversationsPerScenario": 3,
    "maxTurns": 8,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "scenarios": [
    {
      "scenarioId": "scenario-1",
      "scenarioName": "user books a morning slot",
      "passed": true,
      "conversations": [
        {
          "conversationId": "conv-1-a3f8b2c1",
          "passed": true,
          "turns": [
            {
              "turnIndex": 0,
              "userMessage": "I'd like to book a haircut for next Tuesday morning.",
              "agentMessage": "I can help you with that!...",
              "toolCalls": [
                {
                  "name": "check_availability",
                  "arguments": { "date": "2026-03-25" },
                  "result": { "available": true, "slots": ["09:00", "09:45", "10:30"] }
                }
              ],
              "evaluation": {
                "helpfulness": { "value": 4.5, "reason": "..." },
                "coherence": { "value": 5.0, "reason": "..." },
                "relevance": { "value": 5.0, "reason": "..." }
              }
            }
          ],
          "trajectoryResult": {
            "matched": true,
            "missingCalls": [],
            "extraCalls": [],
            "orderingIssues": []
          },
          "error": null
        }
      ],
      "summary": {
        "conversationCount": 3,
        "passedCount": 3,
        "errorCount": 0,
        "averageScores": {
          "helpfulness": 4.5,
          "coherence": 4.9,
          "relevance": 5.0,
          "goal_completion": 1.0
        },
        "thresholdViolations": [],
        "uniqueErrors": []
      }
    }
  ],
  "summary": {
    "totalScenarios": 2,
    "passedScenarios": 1,
    "failedScenarios": 1,
    "totalConversations": 6,
    "passedConversations": 5,
    "errorConversations": 0
  }
}
```

### Use Cases

**1. Custom reporting:**

```ts
import results from './.agentest/results.json'

// Generate a custom HTML report
const htmlReport = generateHTMLReport(results)
fs.writeFileSync('report.html', htmlReport)
```

**2. Metric analysis:**

```ts
import results from './.agentest/results.json'

// Calculate average helpfulness across all scenarios
const allScores = results.scenarios.flatMap(s =>
  s.conversations.flatMap(c =>
    c.turns.map(t => t.evaluation.helpfulness.value)
  )
)

const avgHelpfulness = allScores.reduce((a, b) => a + b) / allScores.length
console.log(`Overall helpfulness: ${avgHelpfulness}`)
```

**3. CI integration:**

```ts
import results from './.agentest/results.json'

// Post results to Slack/Discord
if (results.summary.failedScenarios > 0) {
  await postToSlack({
    text: `⚠️ ${results.summary.failedScenarios} agent tests failed`,
    details: results.scenarios.filter(s => !s.passed)
  })
}
```

**4. Trend tracking:**

```ts
// Store results in database for historical tracking
await db.testRuns.insert({
  timestamp: new Date(results.completedAt),
  passed: results.summary.failedScenarios === 0,
  avgHelpfulness: results.scenarios[0].summary.averageScores.helpfulness,
  duration: results.durationMs
})
```

### Configuration

```ts
export default defineConfig({
  reporters: ['console', 'json'],
})
```

The JSON file is written after all scenarios complete, so it's safe to read in post-test scripts.

## GitHub Actions Reporter

Integrates with GitHub Actions to show test results directly in your PR.

### Features

- ✅ Markdown summary table in workflow summary
- ✅ Inline annotations on failed tests
- ✅ Error/warning/notice annotations
- ✅ Links to specific files and lines (when applicable)

### Summary Table

The reporter writes a markdown summary to `$GITHUB_STEP_SUMMARY`:

```markdown
## Agentest Results

**Status:** ❌ FAILED (1/2 scenarios passed)

| Scenario | Status | Conversations | Avg Helpfulness | Avg Coherence | Errors |
|----------|--------|---------------|-----------------|---------------|--------|
| user books a morning slot | ✅ PASS | 3/3 | 4.5 | 4.9 | 0 |
| user cancels booking | ❌ FAIL | 2/3 | 3.55 | 4.25 | 1 |

### Failed Scenarios

#### user cancels booking

**Reason:** Threshold violation: goal_completion (0.5 < 0.8)

**Unique Errors:**
- `[high]` Agent Failed to Complete Cancellation (1 occurrence)
```

### Annotations

The reporter emits GitHub Actions annotations that appear inline in the "Files changed" tab of PRs:

```
::error file=tests/booking.sim.ts,line=42::Scenario 'user cancels booking' failed: Threshold violation: goal_completion (0.5 < 0.8)
::warning::Agent behavior failure detected: repetition (3 occurrences)
::notice::Scenario 'user books a morning slot' passed with average helpfulness: 4.5
```

**Annotation types:**

| Type | When Used | Shows In PR |
|------|-----------|-------------|
| `error` | Scenario fails | ❌ Red annotation |
| `warning` | High-severity errors detected | ⚠️ Yellow annotation |
| `notice` | Informational (scenario passed) | ℹ️ Blue annotation |

### Configuration

```ts
export default defineConfig({
  reporters: ['console', 'github-actions'],
})
```

### GitHub Actions Workflow

```yaml
name: Agent Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install

      - name: Run agent tests
        run: npx agentest run
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AGENT_API_KEY: ${{ secrets.AGENT_API_KEY }}
```

The GitHub Actions reporter automatically detects when running in GitHub Actions (checks for `GITHUB_ACTIONS=true` environment variable).

### Local Testing

The GitHub Actions reporter only outputs to `$GITHUB_STEP_SUMMARY` when the environment variable exists. Locally, it's a no-op (won't error, just won't output anything).

## Using Multiple Reporters

Combine reporters to get different views:

```ts
export default defineConfig({
  reporters: ['console', 'json', 'github-actions'],
})
```

**Why use multiple reporters:**

- **Local development:** `console` for quick feedback
- **CI:** `console` + `github-actions` for workflow logs + PR annotations
- **Data analysis:** `json` for post-processing and trend tracking
- **Custom integrations:** `json` to feed data into other tools

### Performance Impact

Reporters run in parallel and have minimal performance impact:

- **Console:** Minimal (just formatting and output)
- **JSON:** Minimal (single file write after completion)
- **GitHub Actions:** Minimal (formats markdown and writes to env var)

Using all three reporters typically adds < 100ms to total run time.

## Custom Reporters

Agentest doesn't currently support custom reporters via plugin API, but you can build custom reporting by:

1. Using the JSON reporter
2. Reading `.agentest/results.json`
3. Processing however you want

**Example: Custom HTML reporter**

```ts
// generate-report.ts
import fs from 'fs'
import results from './.agentest/results.json'

const html = `
<!DOCTYPE html>
<html>
<head><title>Test Results</title></head>
<body>
  <h1>Agentest Results</h1>
  ${results.scenarios.map(scenario => `
    <div class="scenario ${scenario.passed ? 'pass' : 'fail'}">
      <h2>${scenario.scenarioName}</h2>
      <p>Conversations: ${scenario.conversations.length}</p>
      <p>Average Helpfulness: ${scenario.summary.averageScores.helpfulness}</p>
    </div>
  `).join('')}
</body>
</html>
`

fs.writeFileSync('test-report.html', html)
```

Run after tests:

```bash
npx agentest run && node generate-report.ts
```

## Troubleshooting

### JSON file not created

**Cause:** Test run failed before completion (e.g., Ctrl+C, unhandled error)

**Solution:** The JSON file is only written after all scenarios complete. If you interrupt the run, no file is created.

### GitHub Actions annotations not showing

**Causes:**
1. Not running in GitHub Actions environment
2. `GITHUB_STEP_SUMMARY` env var not set
3. Workflow doesn't have write permissions

**Solution:**

```yaml
jobs:
  test:
    permissions:
      checks: write  # Required for annotations
      contents: read
```

### Verbose output too large

**Cause:** Many long conversations with `--verbose` flag

**Solution:**
- Use `--scenario` to filter specific tests
- Remove `--verbose` in CI (only use locally)
- Use JSON reporter + custom formatting instead

## Next Steps

- [CLI Reference](/reference/cli) - Command-line options including `--verbose`
- [Pass/Fail Logic](/guide/pass-fail-logic) - Understand test results
- [Configuration](/guide/configuration) - Configure reporters in your config
