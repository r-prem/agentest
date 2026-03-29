import { describe, it, expect } from 'vitest'
import { ErrorDetection, type FailureTurn } from './errorDetection.js'

describe('ErrorDetection.collectFailures', () => {
  it('collects qualitative failures (non "no failure" labels)', () => {
    // ErrorDetection needs an LLM for deduplicate(), but collectFailures is pure
    const detection = new ErrorDetection(null as any)

    const failures = detection.collectFailures('test-scenario', 'conv-1', [
      {
        turnIndex: 0,
        metrics: {
          helpfulness: { value: 4, reason: 'Good' },
          agent_behavior_failure: { value: 'no failure', reason: 'Clean' },
        },
      },
      {
        turnIndex: 1,
        metrics: {
          helpfulness: { value: 2, reason: 'Poor' },
          agent_behavior_failure: {
            value: 'false information',
            reason: 'Agent stated slot is available when it is not',
          },
        },
      },
      {
        turnIndex: 2,
        metrics: {
          tool_call_behavior_failure: {
            value: 'wrong arguments',
            reason: 'Used wrong date format',
          },
        },
      },
    ])

    expect(failures).toHaveLength(2)
    expect(failures[0].label).toBe('false information')
    expect(failures[0].turnIndex).toBe(1)
    expect(failures[0].metricName).toBe('agent_behavior_failure')
    expect(failures[1].label).toBe('wrong arguments')
    expect(failures[1].turnIndex).toBe(2)
  })

  it('returns empty for clean turns', () => {
    const detection = new ErrorDetection(null as any)

    const failures = detection.collectFailures('test-scenario', 'conv-1', [
      {
        turnIndex: 0,
        metrics: {
          helpfulness: { value: 5, reason: 'Perfect' },
          agent_behavior_failure: { value: 'no failure', reason: 'Clean' },
        },
      },
    ])

    expect(failures).toHaveLength(0)
  })
})
