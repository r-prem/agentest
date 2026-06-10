import { createOpenAI } from '@ai-sdk/openai'
import { createLLMProvider, type LLMProvider } from './provider.js'

export interface OpenAICompatibleOptions {
  baseURL: string
  apiKey?: string
  timeoutMs?: number
  /**
   * Extra fields to merge into every JSON request body sent to the endpoint.
   * Useful for vendor-specific params not exposed by the AI SDK, e.g.
   * `{ chat_template_kwargs: { enable_thinking: false } }` for Qwen3 models.
   */
  extraBody?: Record<string, unknown>
}

export function createOpenAICompatibleProvider(
  modelId: string,
  options: OpenAICompatibleOptions,
): LLMProvider {
  const customFetch =
    options.extraBody && Object.keys(options.extraBody).length > 0
      ? createExtraBodyFetch(options.extraBody)
      : undefined
  const provider = createOpenAI({
    baseURL: options.baseURL,
    apiKey: options.apiKey ?? 'not-needed',
    ...(customFetch ? { fetch: customFetch } : {}),
  })
  return createLLMProvider(provider.chat(modelId), 'openai-compatible', options.timeoutMs)
}

function createExtraBodyFetch(extra: Record<string, unknown>): typeof fetch {
  return async (input, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body) as Record<string, unknown>
        init = { ...init, body: JSON.stringify({ ...parsed, ...extra }) }
      } catch {
        // Non-JSON body — leave it alone.
      }
    }
    return fetch(input, init)
  }
}
