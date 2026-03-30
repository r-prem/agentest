# Scenario API

Complete reference for `scenario()` and scenario options.

## `scenario()`

```ts
import { scenario } from '@agentesting/agentest'

scenario(name: string, options: ScenarioOptions)
```

Define a test scenario for your agent.

## Required Options

### `profile`

**Type:** `string`

**Required**

Simulated user's personality and context.

### `goal`

**Type:** `string`

**Required**

What the user wants to accomplish.

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
