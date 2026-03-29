import { describe, it, expect } from 'vitest'
import { defineConfig } from './defineConfig.js'

const validAgent = {
  name: 'test-agent',
  endpoint: 'http://localhost:3000/api/chat',
}

describe('defineConfig', () => {
  it('accepts a valid minimal config', () => {
    const config = defineConfig({ agent: validAgent })
    expect(config.agent.name).toBe('test-agent')
    expect(config.agent.type).toBe('chat_completions')
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-sonnet-4-20250514')
    expect(config.conversationsPerScenario).toBe(3)
    expect(config.maxTurns).toBe(8)
    expect(config.concurrency).toBe(20)
    expect(config.unmockedTools).toBe('error')
    expect(config.reporters).toEqual(['console'])
  })

  it('accepts a fully specified config', () => {
    const config = defineConfig({
      agent: {
        ...validAgent,
        type: 'chat_completions',
        headers: { 'X-Custom': 'value' },
        body: { model: 'gpt-4o' },
      },
      model: 'gpt-4o',
      provider: 'openai',
      conversationsPerScenario: 5,
      maxTurns: 10,
      concurrency: 10,
      metrics: ['helpfulness', 'coherence'],
      thresholds: { helpfulness: 3.5 },
      reporters: ['console', 'json'],
      unmockedTools: 'passthrough',
    })
    expect(config.provider).toBe('openai')
    expect(config.conversationsPerScenario).toBe(5)
    expect(config.thresholds).toEqual({ helpfulness: 3.5 })
  })

  it('rejects invalid endpoint', () => {
    expect(() =>
      defineConfig({ agent: { name: 'test', endpoint: 'not-a-url' } }),
    ).toThrow()
  })

  it('rejects negative conversationsPerScenario', () => {
    expect(() =>
      defineConfig({ agent: validAgent, conversationsPerScenario: -1 }),
    ).toThrow()
  })

  it('interpolates env vars in headers', () => {
    process.env.TEST_API_KEY = 'secret123'
    try {
      const config = defineConfig({
        agent: {
          ...validAgent,
          headers: { Authorization: 'Bearer ${TEST_API_KEY}' },
        },
      })
      expect(config.agent.headers?.Authorization).toBe('Bearer secret123')
    } finally {
      delete process.env.TEST_API_KEY
    }
  })

  it('throws on missing env var in headers', () => {
    delete process.env.NONEXISTENT_VAR
    expect(() =>
      defineConfig({
        agent: {
          ...validAgent,
          headers: { Authorization: 'Bearer ${NONEXISTENT_VAR}' },
        },
      }),
    ).toThrow('NONEXISTENT_VAR')
  })
})
