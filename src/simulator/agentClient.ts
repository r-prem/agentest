import type { AgentestConfig, CustomAgentHandler } from '../config/schema.js'
import type { CustomHandlerContext } from '../scenario/types.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AgentResponse {
  message: ChatMessage
  toolCalls: ToolCall[]
  hasToolCalls: boolean
}

const MAX_ERROR_BODY_LENGTH = 500
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BODY_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_PROTOCOLS = ['http:', 'https:']
const SENSITIVE_PATTERN =
  /(?:Bearer\s+|api[_-]?key[:\s=]+|authorization[:\s=]+|token[:\s=]+|secret[:\s=]+|x-api-key[:\s=]+)\S+/gi

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google',
  'localhost',
])

function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname)) return true

  // IPv4 loopback, private ranges
  if (
    /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname)
  ) {
    return true
  }

  // IPv6 loopback, link-local, unique local, IPv4-mapped private
  if (
    hostname === '::1' ||
    hostname === '::' ||
    hostname.startsWith('fe80:') || // link-local
    hostname.startsWith('fc00:') || // unique local
    hostname.startsWith('fd') || // unique local (fd00::/8)
    hostname.startsWith('::ffff:127.') || // IPv4-mapped loopback
    hostname.startsWith('::ffff:10.') || // IPv4-mapped 10.x
    hostname.startsWith('::ffff:192.168.') // IPv4-mapped 192.168.x
  ) {
    return true
  }

  // IPv4-mapped 172.16-31.x.x
  const mapped172 = hostname.match(/^::ffff:172\.(\d+)\.\d+\.\d+$/)
  if (mapped172) {
    const second = parseInt(mapped172[1], 10)
    if (second >= 16 && second <= 31) return true
  }

  return false
}

function redactSecrets(text: string): string {
  return text.replace(SENSITIVE_PATTERN, '[REDACTED]')
}

export class AgentClient {
  private mode: 'chat_completions' | 'custom'
  private endpoint?: string
  private headers: Record<string, string>
  private bodyDefaults: Record<string, unknown>
  private requestTimeoutMs: number
  private customHandler?: CustomAgentHandler
  private streaming: boolean
  private handlerContext?: CustomHandlerContext

  constructor(config: AgentestConfig) {
    const agent = config.agent

    if (agent.type === 'custom') {
      this.mode = 'custom'
      this.customHandler = agent.handler as unknown as CustomAgentHandler
      this.headers = {}
      this.bodyDefaults = {}
      this.streaming = false
    } else {
      this.mode = 'chat_completions'
      this.endpoint = agent.endpoint
      this.validateEndpoint(this.endpoint)
      this.headers = {
        'Content-Type': 'application/json',
        ...agent.headers,
      }
      this.bodyDefaults = agent.body ?? {}
      this.streaming = agent.streaming ?? false
    }

    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  setHandlerContext(ctx: CustomHandlerContext): void {
    this.handlerContext = ctx
  }

  private validateEndpoint(endpoint: string): void {
    const url = new URL(endpoint)
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      throw new Error(`Agent endpoint must use http: or https: protocol, got "${url.protocol}"`)
    }
    if (!process.env.AGENTEST_ALLOW_PRIVATE_ENDPOINTS) {
      // Strip brackets from IPv6 hostnames (URL parser wraps them: [::1] → ::1)
      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      if (isPrivateHost(hostname)) {
        throw new Error(
          `Agent endpoint "${hostname}" resolves to a private/internal address. ` +
            `Set AGENTEST_ALLOW_PRIVATE_ENDPOINTS=1 to override.`,
        )
      }
    }
  }

  async send(messages: ChatMessage[]): Promise<AgentResponse> {
    if (this.mode === 'custom') {
      return this.sendCustom(messages)
    }
    return this.sendChatCompletions(messages)
  }

  private async sendCustom(messages: ChatMessage[]): Promise<AgentResponse> {
    const result = await this.customHandler!(messages, this.handlerContext!)
    const message = result as ChatMessage

    if (!message || typeof message.role !== 'string') {
      throw new Error(`Custom handler returned an invalid message: missing or invalid "role" field`)
    }

    // Normalize null/undefined content to empty string
    if (message.content == null) {
      message.content = ''
    }

    const toolCalls = message.tool_calls ?? []

    return {
      message,
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
    }
  }

  private async sendChatCompletions(messages: ChatMessage[]): Promise<AgentResponse> {
    const body: Record<string, unknown> = {
      ...this.bodyDefaults,
      messages: this.mergeMessages(messages),
    }

    if (this.streaming) {
      body.stream = true
    }

    const response = await fetch(this.endpoint!, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Agent endpoint returned ${response.status}: ${redactSecrets(text.slice(0, MAX_ERROR_BODY_LENGTH))}`,
      )
    }

    if (this.streaming) {
      return this.readStreamingResponse(response)
    }

    const text = await this.readBoundedBody(response)

    let data: { choices?: Array<{ message?: ChatMessage }> }
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(
        `Agent endpoint returned invalid JSON: ${redactSecrets(text.slice(0, MAX_ERROR_BODY_LENGTH))}`,
      )
    }

    const message = data?.choices?.[0]?.message
    if (
      !message ||
      typeof message.role !== 'string' ||
      (message.content !== null && typeof message.content !== 'string')
    ) {
      throw new Error(
        `Agent endpoint returned an invalid message structure: ${redactSecrets(text.slice(0, MAX_ERROR_BODY_LENGTH))}`,
      )
    }

    // Normalize null content to empty string for downstream consumers
    if (message.content === null) {
      message.content = ''
    }

    const toolCalls: ToolCall[] = []
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        if (
          tc &&
          typeof tc.id === 'string' &&
          tc.type === 'function' &&
          tc.function &&
          typeof tc.function.name === 'string' &&
          typeof tc.function.arguments === 'string'
        ) {
          toolCalls.push(tc)
        }
      }
    }

    return {
      message: { ...message, tool_calls: toolCalls.length > 0 ? toolCalls : undefined },
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
    }
  }

  private async readStreamingResponse(response: Response): Promise<AgentResponse> {
    const text = await this.readBoundedBody(response)
    const lines = text.split('\n')

    let role: ChatMessage['role'] = 'assistant'
    let content = ''
    const toolCallMap = new Map<
      number,
      { id: string; type: 'function'; function: { name: string; arguments: string } }
    >()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue

      const payload = trimmed.slice(6)
      if (payload === '[DONE]') break

      let chunk: {
        choices?: Array<{
          delta?: {
            role?: string
            content?: string | null
            tool_calls?: Array<{
              index: number
              id?: string
              type?: string
              function?: { name?: string; arguments?: string }
            }>
          }
        }>
      }

      try {
        chunk = JSON.parse(payload)
      } catch {
        console.warn(`[agentest] Skipping malformed SSE chunk: ${payload.slice(0, 200)}`)
        continue
      }

      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      if (delta.role) {
        role = delta.role as ChatMessage['role']
      }

      if (delta.content) {
        content += delta.content
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallMap.get(tc.index)
          if (existing) {
            if (tc.function?.name) existing.function.name += tc.function.name
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
          } else {
            toolCallMap.set(tc.index, {
              id: tc.id ?? '',
              type: 'function',
              function: {
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? '',
              },
            })
          }
        }
      }
    }

    const toolCalls = [...toolCallMap.values()].filter((tc) => tc.id && tc.function.name)

    const message: ChatMessage = {
      role,
      content: content || '',
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }

    return {
      message,
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
    }
  }

  private async readBoundedBody(response: Response): Promise<string> {
    if (!response.body) {
      return response.text()
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    let totalBytes = 0

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > MAX_RESPONSE_BODY_BYTES) {
        reader.cancel()
        throw new Error(`Agent endpoint response exceeded ${MAX_RESPONSE_BODY_BYTES} bytes limit`)
      }

      chunks.push(decoder.decode(value, { stream: true }))
    }

    chunks.push(decoder.decode())
    return chunks.join('')
  }

  private mergeMessages(messages: ChatMessage[]): ChatMessage[] {
    const raw = this.bodyDefaults.messages
    if (raw !== undefined && !Array.isArray(raw)) {
      console.warn('[agentest] agent.body.messages is not an array — ignoring it')
    }
    if (!Array.isArray(raw)) return messages
    const systemMessages = raw.filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === 'object' &&
        'role' in m &&
        typeof (m as Record<string, unknown>).role === 'string',
    )
    return [...systemMessages, ...messages]
  }
}
