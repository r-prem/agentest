import type { LLMProvider } from '../../llm/provider.js'
import type { ToolCallRecord, KnowledgeItem } from '../../scenario/types.js'

export interface ScoreInput {
  goal: string
  profile: string
  knowledge: KnowledgeItem[]
  userMessage: string
  agentMessage: string
  toolCalls: ToolCallRecord[]
  history: Array<{ userMessage: string; agentMessage: string }>
  turnIndex: number
}

export interface ConversationScoreInput {
  goal: string
  profile: string
  knowledge: KnowledgeItem[]
  turns: Array<{
    userMessage: string
    agentMessage: string
    toolCalls: ToolCallRecord[]
  }>
}

export interface QuantResult {
  value: number
  reason: string
}

export interface QualResult {
  value: string
  reason: string
}

abstract class BaseMetric {
  abstract readonly name: string
  private _llm: LLMProvider | null = null

  protected get llm(): LLMProvider {
    if (!this._llm) {
      throw new Error(`LLM provider not set on metric "${this.name}". Call setLLM() before use.`)
    }
    return this._llm
  }

  setLLM(llm: LLMProvider): void {
    this._llm = llm
  }
}

export abstract class QuantitativeMetric extends BaseMetric {
  abstract score(input: ScoreInput): Promise<QuantResult>
}

export abstract class QualitativeMetric extends BaseMetric {
  abstract evaluate(input: ScoreInput): Promise<QualResult>
}

export abstract class ConversationMetric extends BaseMetric {
  abstract score(input: ConversationScoreInput): Promise<QuantResult>
}
