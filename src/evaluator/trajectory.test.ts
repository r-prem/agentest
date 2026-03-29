import { describe, it, expect } from 'vitest'
import { TrajectoryMatcher } from './trajectory.js'
import type { ToolCallRecord } from '../scenario/types.js'

function tc(name: string, args: Record<string, unknown> = {}): ToolCallRecord {
  return { name, args, result: {}, turnIndex: 0 }
}

const matcher = new TrajectoryMatcher()

describe('TrajectoryMatcher — strict', () => {
  it('passes when exact tools in exact order', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('create_booking')],
      {
        matchMode: 'strict',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('fails on wrong order', () => {
    const result = matcher.match(
      [tc('create_booking'), tc('check_availability')],
      {
        matchMode: 'strict',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(false)
    expect(result.orderingIssues.length).toBeGreaterThan(0)
  })

  it('fails on extra calls', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('create_booking'), tc('send_email')],
      {
        matchMode: 'strict',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(false)
    expect(result.extraCalls).toContain('send_email')
  })

  it('fails on missing calls', () => {
    const result = matcher.match([tc('check_availability')], {
      matchMode: 'strict',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    })
    expect(result.matched).toBe(false)
    expect(result.missingCalls).toContain('create_booking')
  })
})

describe('TrajectoryMatcher — unordered', () => {
  it('passes regardless of order', () => {
    const result = matcher.match(
      [tc('create_booking'), tc('check_availability')],
      {
        matchMode: 'unordered',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('fails on extra calls', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('create_booking'), tc('send_email')],
      {
        matchMode: 'unordered',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(false)
    expect(result.extraCalls).toContain('send_email')
  })

  it('fails on missing calls', () => {
    const result = matcher.match([tc('check_availability')], {
      matchMode: 'unordered',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    })
    expect(result.matched).toBe(false)
    expect(result.missingCalls).toContain('create_booking')
  })
})

describe('TrajectoryMatcher — contains', () => {
  it('passes when expected tools are present (extras allowed)', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('send_email'), tc('create_booking')],
      {
        matchMode: 'contains',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(true)
    expect(result.extraCalls).toEqual([])
  })

  it('fails when expected tool is missing', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('send_email')],
      {
        matchMode: 'contains',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(false)
    expect(result.missingCalls).toContain('create_booking')
  })
})

describe('TrajectoryMatcher — within', () => {
  it('passes when all actual calls are in allowed set', () => {
    const result = matcher.match([tc('check_availability')], {
      matchMode: 'within',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'create_booking', argMatchMode: 'ignore' },
      ],
    })
    expect(result.matched).toBe(true)
  })

  it('fails when actual call is not in allowed set', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('send_email')],
      {
        matchMode: 'within',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'create_booking', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(false)
    expect(result.extraCalls).toContain('send_email')
  })
})

describe('TrajectoryMatcher — arg matching', () => {
  it('exact: passes on equal args', () => {
    const result = matcher.match(
      [tc('check_availability', { date: '2026-04-01', time: '09:00' })],
      {
        matchMode: 'strict',
        expected: [
          {
            name: 'check_availability',
            args: { date: '2026-04-01', time: '09:00' },
            argMatchMode: 'exact',
          },
        ],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('exact: fails on different args', () => {
    const result = matcher.match(
      [tc('check_availability', { date: '2026-04-01' })],
      {
        matchMode: 'strict',
        expected: [
          {
            name: 'check_availability',
            args: { date: '2026-04-02' },
            argMatchMode: 'exact',
          },
        ],
      },
    )
    expect(result.matched).toBe(false)
  })

  it('partial: passes when expected keys match', () => {
    const result = matcher.match(
      [tc('check_availability', { date: '2026-04-01', extra: 'value' })],
      {
        matchMode: 'strict',
        expected: [
          {
            name: 'check_availability',
            args: { date: '2026-04-01' },
            argMatchMode: 'partial',
          },
        ],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('partial: fails when expected key has wrong value', () => {
    const result = matcher.match(
      [tc('check_availability', { date: '2026-04-02' })],
      {
        matchMode: 'strict',
        expected: [
          {
            name: 'check_availability',
            args: { date: '2026-04-01' },
            argMatchMode: 'partial',
          },
        ],
      },
    )
    expect(result.matched).toBe(false)
  })

  it('ignore: passes regardless of args', () => {
    const result = matcher.match(
      [tc('check_availability', { anything: 'goes' })],
      {
        matchMode: 'strict',
        expected: [{ name: 'check_availability', argMatchMode: 'ignore' }],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('defaults to ignore when argMatchMode not specified', () => {
    const result = matcher.match(
      [tc('check_availability', { anything: 'goes' })],
      {
        matchMode: 'strict',
        expected: [{ name: 'check_availability' }],
      },
    )
    expect(result.matched).toBe(true)
  })
})

describe('TrajectoryMatcher — duplicate tool calls', () => {
  it('contains: matches duplicate expected calls independently', () => {
    const result = matcher.match(
      [tc('check_availability'), tc('check_availability')],
      {
        matchMode: 'contains',
        expected: [
          { name: 'check_availability', argMatchMode: 'ignore' },
          { name: 'check_availability', argMatchMode: 'ignore' },
        ],
      },
    )
    expect(result.matched).toBe(true)
  })

  it('contains: fails when not enough duplicates', () => {
    const result = matcher.match([tc('check_availability')], {
      matchMode: 'contains',
      expected: [
        { name: 'check_availability', argMatchMode: 'ignore' },
        { name: 'check_availability', argMatchMode: 'ignore' },
      ],
    })
    expect(result.matched).toBe(false)
    expect(result.missingCalls).toContain('check_availability')
  })
})
