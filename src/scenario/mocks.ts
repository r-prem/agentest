import type { ToolMockFn } from './types.js'

const SEQUENCE_BRAND = Symbol('agentest.sequence')

export interface SequenceMock extends ToolMockFn {
  [SEQUENCE_BRAND]: true
  reset(): void
}

export function sequence<T>(values: T[]): SequenceMock {
  if (values.length === 0) {
    throw new Error('sequence() requires at least one value')
  }

  let index = 0

  const fn: SequenceMock = Object.assign(
    (_args: Record<string, unknown>) => {
      const value = values[Math.min(index, values.length - 1)]
      index++
      return value
    },
    {
      [SEQUENCE_BRAND]: true as const,
      reset() {
        index = 0
      },
    },
  )

  return fn
}

export function isSequenceMock(fn: unknown): fn is SequenceMock {
  return typeof fn === 'function' && SEQUENCE_BRAND in fn
}

export class AgentestError extends Error {
  constructor(
    message: string,
    public readonly context: {
      scenario: string
      conversationId: string
      turnIndex: number
      toolName?: string
    },
  ) {
    super(message)
    this.name = 'AgentestError'
  }
}

export class MockResolver {
  private callCounts = new Map<string, number>()

  constructor(
    private mocks: Record<string, ToolMockFn> | undefined,
    private unmockedBehavior: 'error' | 'passthrough',
    private scenarioName: string,
    private conversationId: string,
  ) {}

  reset(): void {
    this.callCounts = new Map()
    if (this.mocks) {
      for (const mock of Object.values(this.mocks)) {
        if (isSequenceMock(mock)) {
          mock.reset()
        }
      }
    }
  }

  async resolve(
    toolName: string,
    args: Record<string, unknown>,
    turnIndex: number,
  ): Promise<{ result: unknown; mocked: boolean }> {
    const mock = this.mocks?.[toolName]

    if (!mock) {
      if (this.unmockedBehavior === 'error') {
        throw new AgentestError(
          `Agent called unmocked tool "${toolName}"\n` +
            `  in scenario: "${this.scenarioName}"\n` +
            `  conversation: ${this.conversationId}\n` +
            `  turn: ${turnIndex}\n\n` +
            `  Add a mock for this tool:\n` +
            `    mocks: {\n` +
            `      tools: {\n` +
            `        ${toolName}: (args) => ({ /* mock result */ })\n` +
            `      }\n` +
            `    }\n\n` +
            `  Or allow passthrough in config:\n` +
            `    unmockedTools: 'passthrough'`,
          {
            scenario: this.scenarioName,
            conversationId: this.conversationId,
            turnIndex,
            toolName,
          },
        )
      }
      return { result: undefined, mocked: false }
    }

    const callIndex = this.callCounts.get(toolName) ?? 0
    this.callCounts.set(toolName, callIndex + 1)

    const result = await mock(args, {
      callIndex,
      conversationId: this.conversationId,
      turnIndex,
    })

    return { result, mocked: true }
  }
}
