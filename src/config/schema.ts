import { z } from 'zod'

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

const chatCompletionsAgentSchema = z.object({
  type: z.literal('chat_completions'),
  name: z.string(),
  endpoint: z.string().url(),
  headers: z
    .record(
      z.string().regex(/^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/, 'Invalid header name'),
      z.string().refine((v) => !/[\r\n]/.test(v), 'Header values must not contain CR or LF'),
    )
    .optional(),
  body: z.record(z.unknown()).optional(),
  streaming: z.boolean().default(false),
})

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
})

const customAgentSchema = z.object({
  type: z.literal('custom'),
  name: z.string(),
  handler: z
    .function()
    .args(z.array(chatMessageSchema))
    .returns(z.promise(chatMessageSchema)),
})

export const agentConfigSchema = z.preprocess(
  (val) => {
    if (typeof val === 'object' && val !== null && !('type' in val)) {
      return { ...val, type: 'chat_completions' }
    }
    return val
  },
  z.discriminatedUnion('type', [chatCompletionsAgentSchema, customAgentSchema]),
)

export type CustomAgentHandler = (
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string | null
    tool_call_id?: string
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>
  }>,
) => Promise<{
  role: 'assistant'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}>

const VALID_METRIC_NAMES = [
  'helpfulness',
  'coherence',
  'relevance',
  'faithfulness',
  'verbosity',
  'goal_completion',
  'agent_behavior_failure',
  'tool_call_behavior_failure',
] as const

const BINARY_METRICS = new Set(['goal_completion'])

export const thresholdsSchema = z
  .record(z.number().min(0).max(5))
  .refine(
    (rec) =>
      Object.keys(rec).every((key) => (VALID_METRIC_NAMES as readonly string[]).includes(key)),
    (rec) => ({
      message: `Unknown metric name(s) in thresholds: ${Object.keys(rec)
        .filter((k) => !(VALID_METRIC_NAMES as readonly string[]).includes(k))
        .join(', ')}. Valid names: ${VALID_METRIC_NAMES.join(', ')}`,
    }),
  )
  .refine(
    (rec) =>
      Object.entries(rec).every(([key, val]) => !BINARY_METRICS.has(key) || (val >= 0 && val <= 1)),
    (rec) => ({
      message: `Threshold for binary metric(s) must be between 0 and 1: ${Object.entries(rec)
        .filter(([key, val]) => BINARY_METRICS.has(key) && (val < 0 || val > 1))
        .map(([key]) => key)
        .join(', ')}`,
    }),
  )

export const configSchema = z.object({
  agent: agentConfigSchema,

  model: z.string().default(DEFAULT_MODEL),
  provider: z
    .enum(['openai', 'anthropic', 'google', 'ollama', 'openai-compatible'])
    .default('anthropic'),
  providerOptions: z
    .object({
      baseURL: z.string().url().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),

  conversationsPerScenario: z.number().int().positive().default(3),
  maxTurns: z.number().int().positive().default(8),
  requestTimeoutMs: z.number().int().min(1000).max(300_000).default(30_000),
  concurrency: z.number().int().min(1).max(100).default(20),

  metrics: z
    .array(
      z.enum([
        'helpfulness',
        'coherence',
        'relevance',
        'faithfulness',
        'verbosity',
        'goal_completion',
        'agent_behavior_failure',
        'tool_call_behavior_failure',
      ]),
    )
    .optional(),

  thresholds: thresholdsSchema.optional(),

  include: z.array(z.string()).default(['**/*.sim.ts']),
  exclude: z.array(z.string()).default(['node_modules/**']),

  reporters: z.array(z.enum(['console', 'json', 'github-actions'])).default(['console']),

  unmockedTools: z.enum(['error', 'passthrough']).default('error'),

  failOnErrorSeverity: z.enum(['low', 'medium', 'high', 'critical']).default('critical'),

  customMetrics: z
    .array(
      z
        .object({
          name: z.string(),
          setLLM: z.function(),
        })
        .passthrough(),
    )
    .optional(),

  compare: z
    .array(
      z.union([
        // Override: inherits from primary agent, only specify what differs
        z.object({
          name: z.string(),
          endpoint: z.string().url().optional(),
          headers: z.record(z.string()).optional(),
          body: z.record(z.unknown()).optional(),
          streaming: z.boolean().optional(),
        }),
        // Standalone custom handler
        z.object({
          type: z.literal('custom'),
          name: z.string(),
          handler: z.function().args(z.array(z.any())).returns(z.any()),
        }),
      ]),
    )
    .optional(),
})

export type AgentestConfig = z.infer<typeof configSchema>
export type AgentestConfigInput = z.input<typeof configSchema>
