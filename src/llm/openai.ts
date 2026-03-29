import { createOpenAI } from '@ai-sdk/openai'
import { createLLMProvider, type LLMProvider, type ProviderOptions } from './provider.js'

export function createOpenAIProvider(modelId: string, options?: ProviderOptions): LLMProvider {
  const provider = createOpenAI({
    ...(options?.apiKey && { apiKey: options.apiKey }),
    ...(options?.baseURL && { baseURL: options.baseURL }),
  })
  return createLLMProvider(provider(modelId), 'openai')
}
