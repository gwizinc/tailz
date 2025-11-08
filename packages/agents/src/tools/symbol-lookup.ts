/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { tool } from 'ai'
import { z } from 'zod'

import {
  DEFAULT_RESULT_LIMIT,
  MAX_RESULT_LIMIT,
  ensureBoundedLimit,
  semanticCodeSearch,
  type BaseSearchOptions,
  type CodeSearchHit,
  type SearchContext,
} from './semantic-search'

export interface SymbolLookupOptions extends BaseSearchOptions {
  symbol: string
  surroundingLines?: number
}

export interface SymbolMatch {
  start: number
  end: number
  content: string
}

export interface SymbolLookupHit extends CodeSearchHit {
  matches: SymbolMatch[]
}

export const symbolLookupInputSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(256)
    .describe('Code symbol or identifier to locate'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_RESULT_LIMIT)
    .optional()
    .describe('Maximum number of files to inspect'),
  surroundingLines: z
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe('Number of context lines to include before and after each match'),
  extType: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .describe('Optional file extension filter'),
})

function extractSymbolMatches(
  content: string,
  symbol: string,
  surroundingLines: number,
): SymbolMatch[] {
  const lines = content.split(/\r?\n/)
  const loweredSymbol = symbol.toLowerCase()
  const matches: SymbolMatch[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.toLowerCase().includes(loweredSymbol)) {
      const startLine = Math.max(0, index - surroundingLines)
      const endLine = Math.min(lines.length - 1, index + surroundingLines)
      const snippet = lines.slice(startLine, endLine + 1).join('\n')

      matches.push({
        start: startLine + 1,
        end: endLine + 1,
        content: snippet,
      })
    }
  }

  return matches
}

export async function symbolLookup(
  options: SymbolLookupOptions,
): Promise<SymbolLookupHit[]> {
  const trimmedSymbol = options.symbol.trim()

  if (trimmedSymbol.length === 0) {
    throw new Error('Symbol name is required to locate code references')
  }

  const limited = ensureBoundedLimit(options.limit ?? DEFAULT_RESULT_LIMIT)
  const surrounding = Math.max(0, options.surroundingLines ?? 3)

  const fuzzyHits = await semanticCodeSearch({
    repoId: options.repoId,
    branch: options.branch,
    query: trimmedSymbol,
    limit: limited,
    extType: options.extType ?? undefined,
  })

  return fuzzyHits
    .map<SymbolLookupHit>((hit) => ({
      ...hit,
      matches: extractSymbolMatches(hit.content, trimmedSymbol, surrounding),
    }))
    .filter((hit) => hit.matches.length > 0)
}

export function createSymbolLookupTool(context: SearchContext) {
  return tool({
    name: 'symbolLookup',
    description:
      'Locate code symbols or identifiers and return surrounding context lines.',
    inputSchema: symbolLookupInputSchema,
    execute: async ({ symbol, limit, surroundingLines, extType }) => {
      const hits = await symbolLookup({
        ...context,
        symbol,
        limit,
        surroundingLines,
        extType: extType ?? null,
      })

      return {
        hits,
        meta: {
          limit: ensureBoundedLimit(limit),
          surroundingLines: Math.max(0, surroundingLines ?? 3),
          extType: extType ?? null,
        },
      }
    },
  })
}
