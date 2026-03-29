# Custom Metrics

Extend Agentest with your own evaluation metrics.

## Quantitative Metric

```ts
import { QuantitativeMetric, type ScoreInput, type QuantResult } from 'agentest'

export class ToneMetric extends QuantitativeMetric {
  readonly name = 'tone'

  async score(input: ScoreInput): Promise<QuantResult> {
    // Access conversation context
    const { agentMessage, userMessage, toolCalls, history } = input

    // Return numeric score (1-5) with reason
    return { value: 4.5, reason: 'Friendly and professional tone' }
  }
}
```

## Qualitative Metric

```ts
import { QualitativeMetric, type ScoreInput, type QualResult } from 'agentest'

export class BrandVoiceMetric extends QualitativeMetric {
  readonly name = 'brand_voice'

  async evaluate(input: ScoreInput): Promise<QualResult> {
    // Return categorical label with reason
    return { value: 'on brand', reason: 'Matches brand guidelines' }
  }
}
```

## Register Custom Metrics

```ts
import { ToneMetric } from './metrics/tone.js'

export default defineConfig({
  customMetrics: [new ToneMetric()],
  thresholds: {
    tone: 4.0,
  },
})
```

## Using the LLM

```ts
async score(input: ScoreInput): Promise<QuantResult> {
  const result = await this.llm.generateObject({
    schema: z.object({ score: z.number(), reason: z.string() }),
    messages: [{ role: 'user', content: `Rate this: ${input.agentMessage}` }],
  })
  return { value: result.object.score, reason: result.object.reason }
}
```
