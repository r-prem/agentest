export type ToolMockFn = (
  args: Record<string, unknown>,
  ctx: {
    callIndex: number
    conversationId: string
    turnIndex: number
  },
) => unknown | Promise<unknown>

export interface ToolCallAssertion {
  name: string
  args?: Record<string, unknown>
  argMatchMode?: 'exact' | 'partial' | 'ignore'
}

export interface ForbiddenToolAssertion {
  name: string
  args?: Record<string, unknown>
  argMatchMode?: 'exact' | 'partial' | 'ignore'
}

export interface TrajectoryAssertions {
  matchMode: 'strict' | 'unordered' | 'contains' | 'within'
  expected: ToolCallAssertion[]
  forbidden?: ForbiddenToolAssertion[]
}

export interface KnowledgeItem {
  content: string
}

export interface ScriptedTurn {
  userMessage: string
  assertions?: {
    toolCalls?: TrajectoryAssertions
  }
}

export interface ScenarioOptions {
  profile?: string
  goal?: string
  knowledge?: KnowledgeItem[]
  userPromptTemplate?: string

  conversationsPerScenario?: number
  maxTurns?: number

  /** Scripted multi-turn conversation. When provided, profile/goal are optional and SimulatedUser is skipped. */
  turns?: ScriptedTurn[]

  mocks?: {
    tools?: Record<string, ToolMockFn | ReturnType<typeof import('../scenario/mocks.js').sequence>>
  }

  assertions?: {
    toolCalls?: TrajectoryAssertions
  }
}

export function validateScenarioOptions(options: ScenarioOptions): void {
  const isScripted = Array.isArray(options.turns)

  if (isScripted) {
    if (options.turns!.length === 0) {
      throw new Error('Scenario with "turns" must have at least one turn')
    }
    for (let i = 0; i < options.turns!.length; i++) {
      if (!options.turns![i].userMessage?.trim()) {
        throw new Error(`Turn ${i} must have a non-empty "userMessage" string`)
      }
    }
  } else {
    if (!options.profile || typeof options.profile !== 'string') {
      throw new Error('Scenario without "turns" requires a non-empty "profile" string')
    }
    if (!options.goal || typeof options.goal !== 'string') {
      throw new Error('Scenario without "turns" requires a non-empty "goal" string')
    }
  }
}

export interface Scenario {
  name: string
  options: ScenarioOptions
}

export interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  result: unknown
  turnIndex: number
}

export interface CustomHandlerContext {
  /** Resolve a tool call through the scenario's mock system. Records the call for trajectory assertions. */
  resolveTool: (name: string, args: Record<string, unknown>) => Promise<unknown>
  turnIndex: number
  conversationId: string
  scenarioName: string
}
