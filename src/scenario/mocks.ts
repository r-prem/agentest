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
  /**
   * Every unmocked call seen this conversation, recorded even though `resolve()` also
   * throws. The throw alone is not dependable: for a `type: 'custom'` agent it surfaces
   * inside the consumer's own tool implementation, and agent frameworks catch tool errors
   * by design so the model can recover from a genuinely failing tool (LangGraph's ToolNode
   * does this by default). Our error is then handed to the model as an ordinary tool
   * result and the run continues, reporting a downstream symptom instead of the cause.
   *
   * The simulator reads this ledger after the handler returns and fails the conversation
   * on the record alone — no propagation required.
   */
  private unmocked: Array<{ toolName: string; turnIndex: number; message: string }> = []

  constructor(
    private mocks: Record<string, ToolMockFn> | undefined,
    private unmockedBehavior: 'error' | 'passthrough',
    private scenarioName: string,
    private conversationId: string,
  ) {}

  /** Unmocked calls recorded this conversation, in the order they happened. */
  get unmockedCalls(): ReadonlyArray<{ toolName: string; turnIndex: number; message: string }> {
    return this.unmocked
  }

  reset(): void {
    this.callCounts = new Map()
    this.unmocked = []
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
        const error = new AgentestError(
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
        // Record BEFORE throwing — the throw may be swallowed downstream (see `unmocked`).
        this.unmocked.push({ toolName, turnIndex, message: error.message })
        throw error
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
