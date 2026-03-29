import { describe, it, expect } from 'vitest'
import { sequence, MockResolver, AgentestError, isSequenceMock } from './mocks.js'

describe('sequence', () => {
  it('steps through values in order', () => {
    const mock = sequence([{ a: 1 }, { a: 2 }, { a: 3 }])
    expect(mock({} as Record<string, unknown>)).toEqual({ a: 1 })
    expect(mock({} as Record<string, unknown>)).toEqual({ a: 2 })
    expect(mock({} as Record<string, unknown>)).toEqual({ a: 3 })
  })

  it('repeats last value after exhaustion', () => {
    const mock = sequence(['first', 'last'])
    mock({} as Record<string, unknown>)
    mock({} as Record<string, unknown>)
    expect(mock({} as Record<string, unknown>)).toBe('last')
    expect(mock({} as Record<string, unknown>)).toBe('last')
  })

  it('resets index on reset()', () => {
    const mock = sequence([1, 2])
    mock({} as Record<string, unknown>)
    mock({} as Record<string, unknown>)
    mock.reset()
    expect(mock({} as Record<string, unknown>)).toBe(1)
  })

  it('throws on empty array', () => {
    expect(() => sequence([])).toThrow('at least one value')
  })

  it('is detectable via isSequenceMock', () => {
    const mock = sequence([1])
    expect(isSequenceMock(mock)).toBe(true)
    expect(isSequenceMock(() => 1)).toBe(false)
  })
})

describe('MockResolver', () => {
  it('resolves a mocked tool', async () => {
    const resolver = new MockResolver(
      { greet: () => ({ hello: 'world' }) },
      'error',
      'test-scenario',
      'conv-1',
    )

    const { result, mocked } = await resolver.resolve('greet', {}, 0)
    expect(mocked).toBe(true)
    expect(result).toEqual({ hello: 'world' })
  })

  it('passes args and ctx to mock function', async () => {
    let capturedArgs: Record<string, unknown> = {}
    let capturedCtx: { callIndex: number; conversationId: string; turnIndex: number } | undefined

    const resolver = new MockResolver(
      {
        myTool: (args, ctx) => {
          capturedArgs = args
          capturedCtx = ctx
          return 'ok'
        },
      },
      'error',
      'test-scenario',
      'conv-1',
    )

    await resolver.resolve('myTool', { key: 'val' }, 3)
    expect(capturedArgs).toEqual({ key: 'val' })
    expect(capturedCtx).toEqual({
      callIndex: 0,
      conversationId: 'conv-1',
      turnIndex: 3,
    })
  })

  it('increments callIndex per tool', async () => {
    const calls: number[] = []
    const resolver = new MockResolver(
      {
        myTool: (_args, ctx) => {
          calls.push(ctx.callIndex)
          return 'ok'
        },
      },
      'error',
      'test-scenario',
      'conv-1',
    )

    await resolver.resolve('myTool', {}, 0)
    await resolver.resolve('myTool', {}, 1)
    await resolver.resolve('myTool', {}, 2)
    expect(calls).toEqual([0, 1, 2])
  })

  it('throws AgentestError for unmocked tool when behavior is error', async () => {
    const resolver = new MockResolver({}, 'error', 'test-scenario', 'conv-1')

    await expect(resolver.resolve('unknown_tool', {}, 0)).rejects.toThrow(AgentestError)
    await expect(resolver.resolve('unknown_tool', {}, 0)).rejects.toThrow(
      'unmocked tool "unknown_tool"',
    )
  })

  it('returns undefined for unmocked tool when behavior is passthrough', async () => {
    const resolver = new MockResolver({}, 'passthrough', 'test-scenario', 'conv-1')

    const { result, mocked } = await resolver.resolve('unknown_tool', {}, 0)
    expect(mocked).toBe(false)
    expect(result).toBeUndefined()
  })

  it('resets sequence mocks and call counts', async () => {
    const seqMock = sequence([10, 20])
    const resolver = new MockResolver({ counter: seqMock }, 'error', 'test-scenario', 'conv-1')

    const r1 = await resolver.resolve('counter', {}, 0)
    expect(r1.result).toBe(10)
    const r2 = await resolver.resolve('counter', {}, 1)
    expect(r2.result).toBe(20)

    resolver.reset()
    const r3 = await resolver.resolve('counter', {}, 0)
    expect(r3.result).toBe(10)
  })
})
