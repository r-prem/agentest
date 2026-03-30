# Metrics API

API reference for custom metrics.

## Base Classes

### `QuantitativeMetric`

Base class for numeric metrics (1-5 scale).

```ts
import { QuantitativeMetric, type ScoreInput, type QuantResult } from '@agentesting/agentest'

export class MyMetric extends QuantitativeMetric {
  readonly name = 'my_metric'

  async score(input: ScoreInput): Promise<QuantResult> {
    return { value: 4.5, reason: 'Explanation' }
  }
}
```

### `QualitativeMetric`

Base class for categorical metrics.

```ts
import { QualitativeMetric, type ScoreInput, type QualResult } from '@agentesting/agentest'

export class MyMetric extends QualitativeMetric {
  readonly name = 'my_metric'

  async evaluate(input: ScoreInput): Promise<QualResult> {
    return { value: 'category', reason: 'Explanation' }
  }
}
```

## Types

### `ScoreInput`

```ts
interface ScoreInput {
  goal: string
  profile: string
  knowledge: KnowledgeItem[]
  userMessage: string
  agentMessage: string
  toolCalls: ToolCallRecord[]
  history: Turn[]
  turnIndex: number
}
```

### `QuantResult`

```ts
interface QuantResult {
  value: number  // 1-5
  reason: string
}
```

### `QualResult`

```ts
interface QualResult {
  value: string  // categorical label
  reason: string
}
```

## LLM Access

Custom metrics have access to `this.llm`:

```ts
async score(input: ScoreInput): Promise<QuantResult> {
  const result = await this.llm.generateObject({
    schema: z.object({ score: z.number(), reason: z.string() }),
    messages: [{ role: 'user', content: 'prompt' }],
  })
  return { value: result.object.score, reason: result.object.reason }
}
```

## Registration

```ts
import { MyMetric } from './metrics/my-metric'

export default defineConfig({
  customMetrics: [new MyMetric()],
  thresholds: {
    my_metric: 4.0,
  },
})
```
