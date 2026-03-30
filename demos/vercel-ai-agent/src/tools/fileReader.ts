import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const readFile = tool({
  description: 'Read the contents of a local file given its path',
  parameters: z.object({
    filePath: z.string().describe('Path to the file to read'),
  }),
  execute: async ({ filePath }) => {
    try {
      const resolved = resolve(filePath)
      const content = readFileSync(resolved, 'utf-8')
      return content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content
    } catch (err) {
      return `Error reading file: ${(err as Error).message}`
    }
  },
})
