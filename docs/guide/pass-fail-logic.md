# Pass/Fail Logic

Understand how Agentest determines whether scenarios pass or fail.

## Overview

A scenario either passes or fails based on multiple criteria. The overall run passes only if **every scenario passes**. The CLI exits with code `1` on any failure.

## When a Scenario Passes

A scenario **passes** when all of the following conditions are true:

1. ✅ No conversation threw an error
2. ✅ All trajectory assertions matched (if configured) — both scenario-level cumulative and per-turn
3. ✅ No errors at or above the configured `failOnErrorSeverity`
4. ✅ All metric averages meet their configured thresholds

If **any** of these conditions fail, the scenario fails.

## Failure Conditions in Detail

### 1. Conversation Errors

A conversation errors when:

- Agent endpoint is unreachable or returns non-2xx status
- Agent returns invalid JSON or malformed response
- Tool call to an unmocked tool (when `unmockedTools: 'error'`)
- Simulated user fails to generate valid JSON
- Internal Agentest error during simulation

**Example failure:**

```
✗ user books a morning slot
  ✗ conv-1-a3f8b2c1 ERROR: Agent endpoint returned 500
  ✓ conv-2-d9e1f4a7 (2 turns, goal met)
  ✓ conv-3-e8f2g5h9 (3 turns, goal met)

1/3 conversations succeeded
FAIL: 1 conversation errored
```

**Result:** Scenario fails (even though 2/3 conversations succeeded)

### 2. Trajectory Assertion Failures

If the scenario defines `assertions.toolCalls`, every conversation must match the expected trajectory.

**Example failure:**

```ts
assertions: {
  toolCalls: {
    matchMode: 'contains',
    expected: [
      { name: 'check_availability', argMatchMode: 'ignore' },
      { name: 'create_booking', argMatchMode: 'ignore' },
    ],
  },
}
```

If a conversation calls only `check_availability` but not `create_booking`:

```
✓ user books a morning slot
  ✓ conv-1-a3f8b2c1 (2 turns, goal met, trajectory matched)
  ✗ conv-2-d9e1f4a7 (2 turns, goal met, trajectory FAILED)
    Missing tool calls: create_booking
  ✓ conv-3-e8f2g5h9 (2 turns, goal met, trajectory matched)

2/3 conversations passed trajectory assertions
FAIL: Trajectory assertion failed in 1 conversation
```

**Result:** Scenario fails

See [Trajectory Assertions](/guide/trajectory-assertions) for match modes and argument matching.

### 3. Error Severity Gate

Qualitative metrics detect failures and group them by severity. The `failOnErrorSeverity` setting controls which errors cause failures.

**Severity ladder:** `low` → `medium` → `high` → `critical`

```ts
failOnErrorSeverity: 'critical',  // default — only critical errors fail
failOnErrorSeverity: 'high',      // high + critical errors fail
failOnErrorSeverity: 'medium',    // medium + high + critical errors fail
failOnErrorSeverity: 'low',       // any error fails the scenario
```

**Example:**

Config:
```ts
failOnErrorSeverity: 'high',
```

Detected errors:
```
Unique errors:
  [critical] Security Violation: Leaked API Key (1 occurrence)
  [high] False Information About Pricing (2 occurrences)
  [medium] Unnecessary Clarification Requests (3 occurrences)
  [low] Slightly Verbose Responses (5 occurrences)
```

**Result:** Scenario fails (has `critical` and `high` errors, both ≥ `high` threshold)

If config was `failOnErrorSeverity: 'critical'`, only the security violation would cause failure.

See [Evaluation Metrics](/guide/evaluation-metrics#error-deduplication) for severity details.

### 4. Metric Threshold Violations

If any metric's average falls below its configured threshold, the scenario fails.

**Example:**

Config:
```ts
thresholds: {
  helpfulness: 3.5,
  goal_completion: 0.8,
  coherence: 4.0,
},
```

Results:
```
Average scores:
  helpfulness: 3.2 (threshold: 3.5 ✗)
  goal_completion: 0.67 (threshold: 0.8 ✗)
  coherence: 4.5 (threshold: 4.0 ✓)
```

**Result:** Scenario fails (two metrics below threshold)

#### How Averages Are Computed

**Quantitative metrics (1-5 scale):**
- All turn scores across all conversations are averaged
- Example: 3 conversations, 2 turns each → 6 scores → single average

**Goal completion (0/1):**
- Per-conversation scores (0 or 1) are averaged
- Example: 3 conversations, scores [1, 0, 1] → average = 0.67

## Overall Run Pass/Fail

The overall run passes only if **all scenarios pass**.

```
✓ user books a morning slot (3/3 conversations passed)
✗ user cancels booking (1/3 conversations errored)
✓ user reschedules appointment (3/3 conversations passed)

2/3 scenarios passed
FAIL: 1 scenario failed
```

**Exit code:** `1`

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All scenarios passed |
| `1` | One or more scenarios failed, or no scenarios found |

Use in CI:

```yaml
# GitHub Actions example
- name: Run agent tests
  run: npx agentest run
  # Fails the workflow if exit code is 1
```

## Common Failure Scenarios

### Scenario A: Goal Not Completed

```
✓ user asks about weather
  ✓ conv-1 (3 turns, goal NOT met, helpfulness: 4.2)
  ✓ conv-2 (2 turns, goal NOT met, helpfulness: 4.5)
  ✓ conv-3 (4 turns, goal met, helpfulness: 3.8)

goal_completion: 0.33 (threshold: 0.8 ✗)
```

**Why it failed:** Only 1/3 conversations completed the goal, but threshold requires 80%

**How to fix:**
- Improve agent's ability to complete the goal
- Lower threshold if 80% is too strict
- Review conversations to understand why goals weren't met

### Scenario B: Unmocked Tool

```
✗ user books a morning slot
  ✗ conv-1 ERROR: Tool 'send_confirmation_email' was called but no mock is defined
  ✗ conv-2 ERROR: Tool 'send_confirmation_email' was called but no mock is defined
  ✗ conv-3 ERROR: Tool 'send_confirmation_email' was called but no mock is defined
```

**Why it failed:** Agent called a tool that wasn't mocked

**How to fix:**
```ts
mocks: {
  tools: {
    send_confirmation_email: (args) => ({
      success: true,
      messageId: 'msg-123',
    }),
  },
}
```

Or switch to `unmockedTools: 'passthrough'` if you don't want to mock this tool.

### Scenario C: Wrong Tool Sequence

```
✓ user updates booking
  ✗ conv-1 (2 turns, trajectory FAILED)
    Extra tool calls: delete_booking
    Agent called: [check_availability, delete_booking, create_booking]
    Expected (contains): [check_availability, update_booking]
```

**Why it failed:** Agent deleted and recreated booking instead of updating

**How to fix:**
- Improve agent prompts to prefer `update_booking`
- Adjust trajectory assertion if delete+create is acceptable:
```ts
matchMode: 'contains',
expected: [
  { name: 'check_availability', argMatchMode: 'ignore' },
  // Accept either update or delete+create
]
```

### Scenario D: Low Quality Scores

```
✓ user books a morning slot
  ✓ conv-1 (4 turns, goal met, helpfulness: 2.8)
  ✓ conv-2 (5 turns, goal met, helpfulness: 3.1)
  ✓ conv-3 (3 turns, goal met, helpfulness: 3.3)

Average scores:
  helpfulness: 3.07 (threshold: 3.5 ✗)
```

**Why it failed:** Agent completed goals but responses weren't helpful enough

**How to fix:**
- Improve agent prompts for more helpful responses
- Review low-scoring turns with `--verbose` to see what went wrong
- Lower threshold if expectations are too high

## Debugging Failures

### 1. Use Verbose Mode

```bash
npx agentest run --verbose
```

Shows:
- Full conversation transcripts
- Tool calls and results
- Turn-by-turn metric scores
- Error details

### 2. Check JSON Output

```ts
reporters: ['console', 'json'],
```

Writes full results to `.agentest/results.json`:

```json
{
  "scenarios": [
    {
      "scenarioName": "user books a morning slot",
      "conversations": [
        {
          "conversationId": "conv-1-a3f8b2c1",
          "turns": [...],
          "error": null,
          "trajectoryResult": {
            "matched": false,
            "missingCalls": ["create_booking"],
            "extraCalls": [],
            "orderingIssues": []
          },
          "evaluation": {
            "helpfulness": { "value": 3.2, "reason": "..." },
            ...
          }
        }
      ],
      "summary": {
        "passed": false,
        "failureReasons": ["Trajectory assertion failed in 1 conversation"]
      }
    }
  ]
}
```

### 3. Filter to Failing Scenarios

```bash
npx agentest run --scenario "booking"
```

Run only the failing scenario to iterate faster.

### 4. Review Error Deduplication

Check unique errors and their severity:

```
Unique errors:
  [high] Agent Assumes Date Without Confirmation (2 occurrences)
    Agent booked appointments without confirming the date with the user.
    Examples: conv-1 turn 2, conv-3 turn 2

  [medium] Verbose Confirmation Messages (5 occurrences)
    Agent repeated all booking details unnecessarily.
    Examples: conv-1 turn 3, conv-2 turn 2, conv-3 turn 3
```

Focus on fixing high-severity errors first.

## Adjusting Pass/Fail Criteria

### More Lenient

```ts
export default defineConfig({
  // Allow more conversations to fail
  conversationsPerScenario: 5,  // instead of 3

  // Lower thresholds
  thresholds: {
    helpfulness: 3.0,  // instead of 3.5
    goal_completion: 0.6,  // instead of 0.8
  },

  // Only critical errors fail
  failOnErrorSeverity: 'critical',  // instead of 'high'

  // Allow unmocked tools
  unmockedTools: 'passthrough',  // instead of 'error'
})
```

### More Strict

```ts
export default defineConfig({
  // Higher thresholds
  thresholds: {
    helpfulness: 4.5,
    coherence: 4.5,
    relevance: 4.5,
    faithfulness: 5.0,  // no hallucinations allowed
    goal_completion: 1.0,  // all conversations must complete goal
  },

  // Any error fails
  failOnErrorSeverity: 'low',

  // Strict trajectory matching
  assertions: {
    toolCalls: {
      matchMode: 'strict',  // exact sequence required
      expected: [/* exact tools in exact order */],
    },
  },
})
```

## Summary

A scenario passes when:
- All conversations complete without errors
- Trajectory assertions match (if configured)
- No high-severity errors (based on `failOnErrorSeverity`)
- All metric averages meet thresholds

Use verbose mode, JSON output, and error deduplication to debug failures.

Adjust thresholds and severity gates to match your quality bar.

## Next Steps

- [Evaluation Metrics](/guide/evaluation-metrics) - Understand how metrics work
- [Trajectory Assertions](/guide/trajectory-assertions) - Verify tool call sequences
- [Configuration](/guide/configuration) - Configure thresholds and settings
- [CLI Reference](/reference/cli) - Debugging commands and options
