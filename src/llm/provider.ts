import { type LanguageModel, generateText as aiGenerateText, Output } from 'ai'
import { z } from 'zod'

export interface GenerateTextOptions {
  system?: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export interface GenerateObjectOptions<T extends z.ZodType> {
  schema: T
  system?: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export interface LLMProvider {
  readonly model: LanguageModel

  generateText(options: GenerateTextOptions): Promise<{ text: string }>

  generateObject<T extends z.ZodType>(
    options: GenerateObjectOptions<T>,
  ): Promise<{ object: z.infer<T> }>
}

/**
 * Creates an LLMProvider from any Vercel AI SDK LanguageModel instance.
 */
export function createLLMProvider(model: LanguageModel, label: string): LLMProvider {
  return {
    model,

    async generateText(options: GenerateTextOptions) {
      const result = await aiGenerateText({
        model,
        system: options.system,
        messages: options.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
      })
      return { text: result.text }
    },

    async generateObject<T extends z.ZodType>(options: GenerateObjectOptions<T>) {
      const result = await aiGenerateText({
        model,
        system: options.system,
        messages: options.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        output: Output.object({ schema: options.schema }),
      })
      if (result.output == null) {
        throw new Error(`LLM did not return a valid structured output (${label})`)
      }
      return { object: result.output as z.infer<T> }
    },
  }
}

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama' | 'openai-compatible'

export interface ProviderOptions {
  baseURL?: string
  apiKey?: string
}

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'

export async function createProvider(
  provider: ProviderName,
  modelId: string,
  options?: ProviderOptions,
): Promise<LLMProvider> {
  switch (provider) {
    case 'anthropic':
      return createAnthropicProvider(modelId, options)
    case 'openai':
      return createOpenAIProvider(modelId, options)
    case 'google':
      return createGoogleProvider(modelId, options)
    case 'ollama':
      return createOpenAICompatProvider(modelId, {
        baseURL: options?.baseURL ?? DEFAULT_OLLAMA_BASE_URL,
        apiKey: options?.apiKey,
      })
    case 'openai-compatible':
      if (!options?.baseURL) {
        throw new Error(
          'providerOptions.baseURL is required when using the "openai-compatible" provider',
        )
      }
      return createOpenAICompatProvider(modelId, {
        baseURL: options.baseURL,
        apiKey: options.apiKey,
      })
  }
}

async function createAnthropicProvider(modelId: string, options?: ProviderOptions): Promise<LLMProvider> {
  const { createAnthropicProvider: create } = await import('./anthropic.js')
  return create(modelId, options)
}

async function createOpenAIProvider(modelId: string, options?: ProviderOptions): Promise<LLMProvider> {
  const { createOpenAIProvider: create } = await import('./openai.js')
  return create(modelId, options)
}

async function createGoogleProvider(modelId: string, options?: ProviderOptions): Promise<LLMProvider> {
  const { createGoogleProvider: create } = await import('./google.js')
  return create(modelId, options)
}

async function createOpenAICompatProvider(
  modelId: string,
  options: { baseURL: string; apiKey?: string },
): Promise<LLMProvider> {
  const { createOpenAICompatibleProvider: create } = await import('./openai-compatible.js')
  return create(modelId, options)
}
