# Custom Metrics

Extend Agentest with your own evaluation logic. Custom metrics run alongside built-in metrics and participate in thresholds, error deduplication, and reporting.

## Overview

Agentest provides two base classes for custom metrics:

- **`QuantitativeMetric`** — returns a numeric score (e.g., 1-5, 0-1)
- **`QualitativeMetric`** — returns a categorical label (e.g., "on brand", "off brand")

Both have access to the full conversation context and the configured LLM provider for making evaluation calls.

## Quantitative Metrics

Extend `QuantitativeMetric` and implement the `score()` method:

```ts
import { QuantitativeMetric, type ScoreInput, type QuantResult } from '@agentesting/agentest'
import { z } from 'zod'

export class ToneMetric extends QuantitativeMetric {
  readonly name = 'tone'

  async score(input: ScoreInput): Promise<QuantResult> {
    const result = await this.llm.generateObject({
      schema: z.object({
        score: z.number().min(1).max(5),
        reason: z.string(),
      }),
      messages: [
        {
          role: 'system',
          content: `Rate the tone of the assistant's response on a scale of 1-5.
1 = Hostile or dismissive
2 = Cold or robotic
3 = Neutral
4 = Friendly and professional
5 = Warm, empathetic, and engaging`,
        },
        {
          role: 'user',
          content: `User said: ${input.userMessage}\n\nAssistant replied: ${input.agentMessage}`,
        },
      ],
    })

    return { value: result.object.score, reason: result.object.reason }
  }
}
```

### ScoreInput Reference

Every metric receives this input:

```ts
interface ScoreInput {
  goal: string                // scenario goal
  profile: string             // simulated user profile
  knowledge: KnowledgeItem[]  // knowledge items
  userMessage: string         // what the user said this turn
  agentMessage: string        // what the agent replied
  toolCalls: ToolCallRecord[] // tool calls made this turn (name, args, result)
  history: Turn[]             // previous turns (userMessage, agentMessage)
  turnIndex: number           // current turn number (0-indexed)
}
```

Use the full context to make informed evaluations. For example, `history` lets you check consistency across turns, and `toolCalls` lets you verify the agent used tool results correctly.

### Without LLM Calls

Not every metric needs an LLM. You can write purely deterministic metrics:

```ts
export class ResponseLengthMetric extends QuantitativeMetric {
  readonly name = 'response_length'

  async score(input: ScoreInput): Promise<QuantResult> {
    const wordCount = input.agentMessage.split(/\s+/).length

    if (wordCount < 10) return { value: 2, reason: `Too short (${wordCount} words)` }
    if (wordCount > 500) return { value: 2, reason: `Too long (${wordCount} words)` }
    if (wordCount > 200) return { value: 3, reason: `Somewhat verbose (${wordCount} words)` }
    return { value: 5, reason: `Appropriate length (${wordCount} words)` }
  }
}
```

### Checking Tool Usage

Access tool calls and their results to verify agent behavior:

```ts
export class BookingConfirmedMetric extends QuantitativeMetric {
  readonly name = 'booking_confirmed'

  async score(input: ScoreInput): Promise<QuantResult> {
    const bookingCall = input.toolCalls.find(tc => tc.name === 'create_booking')

    if (!bookingCall) {
      return { value: 0, reason: 'create_booking was never called' }
    }

    const success = bookingCall.result?.success === true
    return {
      value: success ? 1 : 0,
      reason: success
        ? `Booking created: ${bookingCall.result.bookingId}`
        : 'create_booking was called but did not return success',
    }
  }
}
```

## Qualitative Metrics

Extend `QualitativeMetric` and implement the `evaluate()` method. Qualitative metrics return categorical labels instead of numbers.

```ts
import { QualitativeMetric, type ScoreInput, type QualResult } from '@agentesting/agentest'
import { z } from 'zod'

export class BrandVoiceMetric extends QualitativeMetric {
  readonly name = 'brand_voice'

  async evaluate(input: ScoreInput): Promise<QualResult> {
    const result = await this.llm.generateObject({
      schema: z.object({
        label: z.enum(['on brand', 'off brand', 'neutral']),
        reason: z.string(),
      }),
      messages: [
        {
          role: 'system',
          content: `Evaluate whether the assistant's response matches brand guidelines:
- On brand: Professional, helpful, uses first person plural ("we"), avoids jargon
- Off brand: Casual slang, overly technical, cold or dismissive
- Neutral: Acceptable but not distinctly on-brand`,
        },
        {
          role: 'user',
          content: `Response: ${input.agentMessage}`,
        },
      ],
    })

    return { value: result.object.label, reason: result.object.reason }
  }
}
```

Qualitative metric labels participate in **error deduplication**. If `brand_voice` returns "off brand", it's treated as a failure and grouped with other failures by root cause.

## Registering Custom Metrics

Add custom metrics to your config:

```ts
import { defineConfig } from '@agentesting/agentest'
import { ToneMetric } from './metrics/tone.js'
import { BrandVoiceMetric } from './metrics/brand-voice.js'
import { BookingConfirmedMetric } from './metrics/booking.js'

export default defineConfig({
  customMetrics: [
    new ToneMetric(),
    new BrandVoiceMetric(),
    new BookingConfirmedMetric(),
  ],

  // Thresholds work with custom metric names
  thresholds: {
    tone: 4.0,
    booking_confirmed: 0.8,
  },
})
```

Custom metrics:
- Run in parallel with built-in metrics (bounded by `concurrency`)
- Appear in console output and JSON reports
- Can have thresholds set just like built-in metrics
- Have `this.llm` set automatically before evaluation begins

## Metric Lifecycle

1. Agentest instantiates your metric from the config
2. Before evaluation, `setLLM()` is called to inject the configured LLM provider
3. For each turn, your `score()` or `evaluate()` method is called in parallel with other metrics
4. If your metric throws, the error is caught and the metric is skipped for that turn (doesn't crash the run)
5. Results are collected into the turn's metrics map

## Testing Custom Metrics

Test your metrics with vitest:

```ts
import { describe, it, expect } from 'vitest'
import { ResponseLengthMetric } from './metrics/response-length.js'

describe('ResponseLengthMetric', () => {
  const metric = new ResponseLengthMetric()

  it('scores short responses low', async () => {
    const result = await metric.score({
      agentMessage: 'Yes.',
      userMessage: 'Can you help me book an appointment?',
      goal: 'Book an appointment',
      profile: 'Casual user',
      knowledge: [],
      toolCalls: [],
      history: [],
      turnIndex: 0,
    })

    expect(result.value).toBe(2)
    expect(result.reason).toContain('Too short')
  })
})
```

For metrics that use `this.llm`, you'll need to call `setLLM()` with a provider instance first. See [Programmatic Usage](/reference/api) for how to create providers.

## Next Steps

- [Evaluation Metrics](/guide/evaluation-metrics) — Built-in metrics reference
- [Metrics API](/reference/metrics-api) — Base class API reference
- [Configuration](/guide/configuration) — Register metrics in config
