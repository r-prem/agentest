import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createLLMProvider, type LLMProvider, type ProviderOptions } from './provider.js'

export function createGoogleProvider(modelId: string, options?: ProviderOptions): LLMProvider {
  const provider = createGoogleGenerativeAI({
    ...(options?.apiKey && { apiKey: options.apiKey }),
    ...(options?.baseURL && { baseURL: options.baseURL }),
  })
  return createLLMProvider(provider(modelId), 'google')
}
