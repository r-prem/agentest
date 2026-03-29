import { createAnthropic } from '@ai-sdk/anthropic'
import { createLLMProvider, type LLMProvider, type ProviderOptions } from './provider.js'

export function createAnthropicProvider(modelId: string, options?: ProviderOptions): LLMProvider {
  const provider = createAnthropic({
    ...(options?.apiKey && { apiKey: options.apiKey }),
    ...(options?.baseURL && { baseURL: options.baseURL }),
  })
  return createLLMProvider(provider(modelId), 'anthropic', options?.timeoutMs)
}
