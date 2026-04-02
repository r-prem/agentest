# Scenario API

Complete reference for `scenario()` and scenario options.

## `scenario()`

```ts
import { scenario } from '@agentesting/agentest'

scenario(name: string, options: ScenarioOptions)
```

Define a test scenario for your agent.

## Required Options

Either `profile` + `goal` (simulated mode) or `turns` (scripted mode) must be provided.

### `profile`

**Type:** `string`

**Required** for simulated mode. Optional for scripted mode.

Simulated user's personality and context.

### `goal`

**Type:** `string`

**Required** for simulated mode. Optional for scripted mode.

What the user wants to accomplish. When provided with scripted `turns`, enables LLM-as-judge evaluation.

### `turns`

**Type:** `ScriptedTurn[]`

**Required** for scripted mode.

Scripted conversation turns with predetermined user messages. When provided, the simulated user is skipped entirely and messages are replayed in order.

Each turn can include per-turn trajectory assertions.

```ts
turns: [
  {
    userMessage: 'What is the status of order ORD-42?',
    assertions: {
      toolCalls: {
        matchMode: 'contains',
        expected: [{ name: 'get_order', argMatchMode: 'ignore' }],
      },
    },
  },
  {
    userMessage: 'Export that to CSV',
    assertions: {
      toolCalls: {
        matchMode: 'contains',
        expected: [{ name: 'export_to_csv', argMatchMode: 'ignore' }],
      },
    },
  },
]
```

Defaults: `conversationsPerScenario` defaults to `1` (deterministic). `maxTurns` is set to `turns.length`.

## Optional Options

### `knowledge`

**Type:** `KnowledgeItem[]`

**Default:** `[]`

Facts the simulated user knows.

```ts
knowledge: [
  { content: 'Fact 1' },
  { content: 'Fact 2' },
]
```

### `mocks`

**Type:** `{ tools: Record<string, ToolMockFn | SequenceMock> }`

**Default:** `{ tools: {} }`

Tool mocks.

```ts
mocks: {
  tools: {
    my_tool: (args, ctx) => ({ result: 'value' }),
  },
}
```

### `assertions`

**Type:** `{ toolCalls?: TrajectoryAssertion }`

**Optional**

Trajectory assertions.

```ts
assertions: {
  toolCalls: {
    matchMode: 'contains',
    expected: [
      { name: 'tool1', argMatchMode: 'ignore' },
    ],
  },
}
```

### `conversationsPerScenario`

**Type:** `number`

**Optional**

Override global setting.

### `maxTurns`

**Type:** `number`

**Optional**

Override global setting.

### `userPromptTemplate`

**Type:** `string`

**Optional**

Custom simulated user prompt template.

## Helper Functions

### `sequence()`

```ts
import { sequence } from '@agentesting/agentest'

const mock = sequence([value1, value2, value3])
```

Create a sequence mock that steps through values.

## Types

### `ToolMockFn`

```ts
type ToolMockFn = (
  args: Record<string, unknown>,
  ctx: {
    callIndex: number
    conversationId: string
    turnIndex: number
  }
) => unknown | Promise<unknown>
```

### `TrajectoryAssertion`

```ts
interface TrajectoryAssertion {
  matchMode: 'strict' | 'unordered' | 'contains' | 'within'
  expected: Array<{
    name: string
    args?: Record<string, unknown>
    argMatchMode?: 'exact' | 'partial' | 'ignore'
  }>
}
```
