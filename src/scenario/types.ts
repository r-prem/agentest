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

export interface ScenarioOptions {
  profile: string
  goal: string
  knowledge?: KnowledgeItem[]
  userPromptTemplate?: string

  conversationsPerScenario?: number
  maxTurns?: number

  mocks?: {
    tools?: Record<string, ToolMockFn | ReturnType<typeof import('../scenario/mocks.js').sequence>>
  }

  assertions?: {
    toolCalls?: TrajectoryAssertions
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
