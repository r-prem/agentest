import { createOpenAI } from '@ai-sdk/openai'
import { createLLMProvider, type LLMProvider } from './provider.js'

export interface OpenAICompatibleOptions {
  baseURL: string
  apiKey?: string
  timeoutMs?: number
}

export function createOpenAICompatibleProvider(
  modelId: string,
  options: OpenAICompatibleOptions,
): LLMProvider {
  const provider = createOpenAI({
    baseURL: options.baseURL,
    apiKey: options.apiKey ?? 'not-needed',
  })
  return createLLMProvider(provider(modelId), 'openai-compatible', options.timeoutMs)
}
