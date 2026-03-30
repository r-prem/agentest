import { tool } from 'ai'
import { z } from 'zod'

export const calculator = tool({
  description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
  parameters: z.object({
    a: z.number().describe('The first number'),
    b: z.number().describe('The second number'),
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('The arithmetic operation to perform'),
  }),
  execute: async ({ a, b, operation }) => {
    switch (operation) {
      case 'add':
        return `${a + b}`
      case 'subtract':
        return `${a - b}`
      case 'multiply':
        return `${a * b}`
      case 'divide':
        return b !== 0 ? `${a / b}` : 'Error: division by zero'
    }
  },
})
