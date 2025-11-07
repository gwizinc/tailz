import { createHash } from 'node:crypto'

import {
  ToolLoopAgent,
  tool,
  Output,
  stepCountIs,
  type StepResult,
  type FinishReason,
} from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAIEmbedding } from '@zilliz/claude-context-core'
import { QdrantClient } from '@qdrant/js-client-rest'
import { logger } from '@trigger.dev/sdk'
import { z } from 'zod'

import type {
  JSONValue,
  StoryTestCodeReference,
  StoryTestFinding,
  StoryTestIssue,
  StoryTestLoopIteration,
  StoryTestResultPayload,
} from '@app/db'

import { buildQdrantErrorDetails } from './qdrant'
import { parseEnv } from './env'

const DEFAULT_STORY_MODEL = 'gpt-4o-mini'
const DEFAULT_MAX_STEPS = 6
const STORY_EVALUATION_AGENT_ID = 'story-evaluation'
const STORY_CONTEXT_TOOL_DEFAULT_LIMIT = 8
const STORY_CONTEXT_TOOL_MAX_LIMIT = 24

export interface StoryContextSnippet {
  id: string
  path: string
  content: string
  commitSha: string
  branch?: string | null
  score: number
}

function ensureStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const codeReferenceSchema = z.object({
  filePath: z.string(),
  repoPath: z.string().nullish(),
  summary: z.string().nullish(),
  startLine: z.number().int().min(0).nullish(),
  endLine: z.number().int().min(0).nullish(),
})

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

const jsonValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
)

const findingSchema = z.object({
  title: z.string(),
  detail: z.string().nullish(),
  references: z.array(codeReferenceSchema).default([]),
})

const issueSchema = z.object({
  title: z.string(),
  description: z.string().nullish(),
  references: z.array(codeReferenceSchema).default([]),
  missing: z.array(z.string()).default([]),
})

const loopIterationSchema = z.object({
  iteration: z.number().int().min(0),
  action: z.string(),
  notes: z.string().nullish(),
  references: z.array(codeReferenceSchema).default([]),
  outputSummary: z.string().nullish(),
})

export const storyTestResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'blocked', 'running']).default('running'),
  summary: z.string().nullish(),
  findings: z.array(findingSchema).default([]),
  issues: z.array(issueSchema).default([]),
  missingRequirements: z.array(z.string()).default([]),
  codeReferences: z.array(codeReferenceSchema).default([]),
  reasoning: jsonValueSchema.default([]),
  loopIterations: z.array(loopIterationSchema).default([]),
  rawOutput: jsonValueSchema.optional(),
  metadata: jsonValueSchema.default({}),
})

export type StoryTestModelOutput = z.infer<typeof storyTestResultSchema>

const storyContextToolInputSchema = z.object({
  query: z.string().min(1).max(8_000).optional(),
  limit: z.number().int().min(1).max(STORY_CONTEXT_TOOL_MAX_LIMIT).optional(),
  extType: z.string().min(1).max(256).optional(),
})

type StoryContextToolInput = z.infer<typeof storyContextToolInputSchema>

export interface StoryEvaluationAgentOptions {
  storyName: string
  storyText: string
  repoId: string
  repoName: string
  branchName?: string | null
  commitSha?: string | null
  initialSnippets?: StoryContextSnippet[]
  runId?: string | null
  maxSteps?: number
  modelId?: string
  openAiApiKey: string
}

export interface StoryEvaluationToolTrace {
  step: number
  toolName: string
  input: JSONValue
  output: JSONValue
}

export interface StoryEvaluationAgentResult {
  output: StoryTestModelOutput
  stepSummaries: StoryTestLoopIteration[]
  toolTrace: StoryEvaluationToolTrace[]
  finishReason: FinishReason
}

export function normalizeStoryTestResult(
  raw: StoryTestModelOutput,
  startedAt: Date,
  completedAt?: Date,
  additionalIterations?: StoryTestLoopIteration[],
): StoryTestResultPayload {
  const completed = completedAt ?? new Date()
  const durationMs = completed.getTime() - startedAt.getTime()

  const loopIterations: StoryTestLoopIteration[] = [
    ...(raw.loopIterations as StoryTestLoopIteration[]),
    ...(additionalIterations ?? []),
  ]

  return {
    status: raw.status,
    summary: raw.summary ?? null,
    findings: raw.findings as StoryTestFinding[],
    issues: raw.issues as StoryTestIssue[],
    missingRequirements: raw.missingRequirements,
    codeReferences: raw.codeReferences as StoryTestCodeReference[],
    reasoning: raw.reasoning,
    loopIterations,
    rawOutput: raw.rawOutput,
    metadata: raw.metadata,
    startedAt: startedAt.toISOString(),
    completedAt: completed.toISOString(),
    durationMs,
  }
}

export async function searchStoryContext(options: {
  repoId: string
  storyText: string
  commitSha?: string | null
  limit?: number
}): Promise<StoryContextSnippet[]> {
  const env = parseEnv()

  const collectionName = `repo_embeddings_${options.repoId}`
  const embedding = new OpenAIEmbedding({
    apiKey: env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  })

  const qdrantClient = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
  })

  const queryVector = (await embedding.embed(options.storyText)).vector

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error('Failed to generate embedding for story query')
  }

  type SearchParams = Parameters<QdrantClient['search']>[1]

  const baseSearchParams: SearchParams = {
    vector: queryVector,
    limit: options.limit ?? 12,
    with_payload: true,
    filter: options.commitSha
      ? {
          must: [
            {
              key: 'commitSha',
              match: { value: options.commitSha },
            },
          ],
        }
      : undefined,
  }

  try {
    const searchResult = await qdrantClient.search(
      collectionName,
      baseSearchParams,
    )

    return searchResult.map((point) => {
      const payload = toRecord(point.payload)
      return {
        id: String(
          point.id ??
            createHash('sha1').update(JSON.stringify(point)).digest('hex'),
        ),
        path: ensureStringValue(payload.path),
        content: ensureStringValue(payload.content),
        commitSha: ensureStringValue(payload.commitSha),
        branch: typeof payload.branch === 'string' ? payload.branch : null,
        score: Number(point.score ?? 0),
      }
    })
  } catch (error) {
    const errorDetails = buildQdrantErrorDetails(error, {
      repoId: options.repoId,
      commitSha: options.commitSha ?? 'unknown',
      collection: collectionName,
      fileCount: 0,
    })

    const message =
      typeof errorDetails.qdrantErrorMessage === 'string'
        ? errorDetails.qdrantErrorMessage
        : error instanceof Error
          ? error.message
          : ''

    const missingIndex =
      Boolean(baseSearchParams.filter) &&
      typeof message === 'string' &&
      message.toLowerCase().includes('index required but not found')

    if (missingIndex) {
      logger.warn(
        'Qdrant missing payload index for commitSha, retrying search without filter',
        {
          repoId: options.repoId,
          commitSha: options.commitSha,
          collection: collectionName,
        },
      )

      try {
        await qdrantClient.createPayloadIndex(collectionName, {
          field_name: 'commitSha',
          field_schema: 'keyword',
          wait: true,
        })
      } catch (indexError) {
        const indexDetails = buildQdrantErrorDetails(indexError, {
          repoId: options.repoId,
          commitSha: options.commitSha ?? 'unknown',
          collection: collectionName,
          fileCount: 0,
        })

        const indexMessage =
          typeof indexDetails.qdrantErrorMessage === 'string'
            ? indexDetails.qdrantErrorMessage
            : indexError instanceof Error
              ? indexError.message
              : ''

        if (!indexMessage.toLowerCase().includes('already exists')) {
          logger.warn(
            'Failed to auto-create commitSha payload index',
            indexDetails,
          )
        }
      }

      const { filter: _filter, ...fallbackParams } = baseSearchParams
      const fallbackResults = await qdrantClient.search(
        collectionName,
        fallbackParams,
      )

      return fallbackResults.map((point) => {
        const payload = toRecord(point.payload)
        return {
          id: String(
            point.id ??
              createHash('sha1').update(JSON.stringify(point)).digest('hex'),
          ),
          path: ensureStringValue(payload.path),
          content: ensureStringValue(payload.content),
          commitSha: ensureStringValue(payload.commitSha),
          branch: typeof payload.branch === 'string' ? payload.branch : null,
          score: Number(point.score ?? 0),
        }
      })
    }

    logger.error('Failed to search Qdrant for story context', errorDetails)
    throw error
  }
}

function createStoryContextTool(options: {
  repoId: string
  storyText: string
  commitSha?: string | null
}) {
  return tool({
    description:
      'Retrieve relevant repository files and code snippets using semantic search in Qdrant.',
    inputSchema: storyContextToolInputSchema,
    execute: async ({ query, limit, extType }: StoryContextToolInput) => {
      const trimmedQuery = typeof query === 'string' ? query.trim() : ''
      const effectiveQuery =
        trimmedQuery.length > 0 ? trimmedQuery : options.storyText
      const requestedLimit =
        typeof limit === 'number' ? limit : STORY_CONTEXT_TOOL_DEFAULT_LIMIT
      const boundedLimit = Math.min(
        Math.max(requestedLimit, 1),
        STORY_CONTEXT_TOOL_MAX_LIMIT,
      )

      try {
        const snippets = await searchStoryContext({
          repoId: options.repoId,
          storyText: effectiveQuery,
          commitSha: options.commitSha ?? undefined,
          limit: boundedLimit,
        })

        return {
          snippets,
          meta: {
            limit: boundedLimit,
            queryLength: effectiveQuery.length,
            extType: extType ?? null,
          },
        }
      } catch (error) {
        logger.warn('retrieveStoryContext tool failed', {
          repoId: options.repoId,
          commitSha: options.commitSha ?? null,
          limit: boundedLimit,
          error,
        })
        throw new Error('Unable to retrieve additional context from Qdrant')
      }
    },
  })
}

type StoryContextTool = ReturnType<typeof createStoryContextTool>

type StoryEvaluationToolSet = {
  retrieveStoryContext: StoryContextTool
}

function buildStoryEvaluationInstructions(): string {
  return [
    'You are an expert software QA engineer evaluating whether a user story can be executed with the current repository state.',
    'Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.',
    'Call the `retrieveStoryContext` tool whenever you need additional code or repository information.',
    'Populate the loopIterations field in your JSON output with concise notes that describe your reasoning steps.',
    'If available evidence is insufficient to decide, mark the status as "blocked" and outline the missing requirements.',
  ].join('\n')
}

function buildStoryEvaluationPrompt(
  options: StoryEvaluationAgentOptions,
): string {
  const lines: string[] = [
    `Story Name: ${options.storyName}`,
    `Repository: ${options.repoName}`,
    `Branch: ${options.branchName ?? 'unknown'}`,
    `Commit: ${options.commitSha ?? 'unspecified'}`,
    'Story Definition:',
    options.storyText,
  ]

  if (options.initialSnippets?.length) {
    const snippetSummaries = options.initialSnippets.map((snippet, index) => {
      const header = `Snippet ${index + 1} • ${snippet.path} (score=${snippet.score.toFixed(3)})`
      return `${header}\n${snippet.content}`
    })

    lines.push(
      `Preloaded Context (${options.initialSnippets.length} snippet${options.initialSnippets.length === 1 ? '' : 's'}):`,
      snippetSummaries.join('\n\n'),
    )
  } else {
    lines.push(
      'Preloaded Context: None provided. Use the retrieveStoryContext tool to request additional snippets as needed.',
    )
  }

  if (options.runId) {
    lines.push(`Run Identifier: ${options.runId}`)
  }

  lines.push(
    'When your analysis is complete, respond only with the JSON object that matches the schema.',
  )

  return lines.join('\n\n')
}

function summarizeAgentSteps(
  steps: Array<StepResult<StoryEvaluationToolSet>>,
): StoryTestLoopIteration[] {
  return steps.map((step, index) => {
    const actionSegments: string[] = []

    if (step.toolCalls.length) {
      const toolNames = step.toolCalls.map((call) => call.toolName).join(', ')
      actionSegments.push(`Called tool(s): ${toolNames}`)
    }

    if (step.toolResults.length) {
      const resultSummaries = step.toolResults.map((result) => {
        if (result.toolName === 'retrieveStoryContext') {
          const snippetCount = Array.isArray(
            (result.output as Record<string, unknown>)?.snippets,
          )
            ? (result.output as { snippets: unknown[] }).snippets.length
            : 0
          return `Received ${snippetCount} snippet${snippetCount === 1 ? '' : 's'} from retrieveStoryContext`
        }
        return `Received output from ${result.toolName}`
      })

      actionSegments.push(resultSummaries.join('; '))
    }

    if (actionSegments.length === 0) {
      actionSegments.push('Generated reasoning step')
    }

    const reasoningText =
      typeof step.reasoningText === 'string' ? step.reasoningText.trim() : ''
    const responseText = typeof step.text === 'string' ? step.text.trim() : ''
    const chosenNotes = reasoningText.length > 0 ? reasoningText : responseText
    const notes = chosenNotes.length > 0 ? truncate(chosenNotes, 600) : null

    return {
      iteration: index,
      action: actionSegments.join(' | '),
      notes,
      references: [],
      outputSummary: `finish=${step.finishReason}`,
    }
  })
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}...`
}

function sanitizeToolInput(input: unknown): JSONValue {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input as JSONValue
  }

  const base = input as Record<string, unknown>
  const sanitized: Record<string, JSONValue> = {}

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) {
      continue
    }

    if (typeof value === 'string') {
      sanitized[key] = truncate(value, 600)
      continue
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value
      continue
    }

    if (value === null) {
      sanitized[key] = null
      continue
    }

    sanitized[key] = structuredClone(value) as JSONValue
  }

  return sanitized
}

function sanitizeToolOutput(output: unknown): JSONValue {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return output as JSONValue
  }

  const record = output as Record<string, unknown>
  const snippets = Array.isArray(record.snippets) ? record.snippets : []

  const trimmedSnippets = snippets.map<JSONValue>((snippet) => {
    if (!snippet || typeof snippet !== 'object' || Array.isArray(snippet)) {
      return snippet as JSONValue
    }

    const snippetRecord = snippet as Record<string, unknown>
    const sanitizedSnippet: Record<string, JSONValue> = {}

    if (typeof snippetRecord.id === 'string') {
      sanitizedSnippet.id = snippetRecord.id
    } else if (
      typeof snippetRecord.id === 'number' ||
      typeof snippetRecord.id === 'boolean'
    ) {
      sanitizedSnippet.id = String(snippetRecord.id)
    }

    if (typeof snippetRecord.path === 'string') {
      sanitizedSnippet.path = snippetRecord.path
    }

    if (typeof snippetRecord.score === 'number') {
      sanitizedSnippet.score = snippetRecord.score
    } else if (typeof snippetRecord.score === 'string') {
      const parsedScore = Number(snippetRecord.score)
      if (!Number.isNaN(parsedScore)) {
        sanitizedSnippet.score = parsedScore
      }
    }

    if (typeof snippetRecord.commitSha === 'string') {
      sanitizedSnippet.commitSha = snippetRecord.commitSha
    }

    if (typeof snippetRecord.branch === 'string') {
      sanitizedSnippet.branch = snippetRecord.branch
    } else if (snippetRecord.branch === null) {
      sanitizedSnippet.branch = null
    }

    if (
      typeof snippetRecord.content === 'string' &&
      snippetRecord.content.length > 0
    ) {
      sanitizedSnippet.excerpt = truncate(snippetRecord.content, 320)
    }

    return sanitizedSnippet
  })

  const sanitized: Record<string, JSONValue> = {
    snippets: trimmedSnippets,
  }

  if (record.meta && typeof record.meta === 'object') {
    sanitized.meta = structuredClone(record.meta) as JSONValue
  }

  return sanitized
}

function extractToolTrace(
  steps: Array<StepResult<StoryEvaluationToolSet>>,
): StoryEvaluationToolTrace[] {
  return steps.flatMap((step, stepIndex) =>
    step.toolResults.map((result) => ({
      step: stepIndex,
      toolName: result.toolName,
      input: sanitizeToolInput(result.input),
      output: sanitizeToolOutput(result.output),
    })),
  )
}

function mergeMetadata(
  base: JSONValue,
  addition: Record<string, JSONValue>,
): JSONValue {
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    const existing = base as Record<string, JSONValue>
    return {
      ...existing,
      ...addition,
    } as JSONValue
  }

  return addition as JSONValue
}

export async function runStoryEvaluationAgent(
  options: StoryEvaluationAgentOptions,
): Promise<StoryEvaluationAgentResult> {
  const openAiProvider = createOpenAI({ apiKey: options.openAiApiKey })
  const effectiveModelId = options.modelId ?? DEFAULT_STORY_MODEL

  const storyContextTool = createStoryContextTool({
    repoId: options.repoId,
    storyText: options.storyText,
    commitSha: options.commitSha ?? null,
  })
  // TODO add new tool for specific file lookup
  // TODO add new tool for specific symbol lookup

  const tools: StoryEvaluationToolSet = {
    retrieveStoryContext: storyContextTool,
  }

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(),
    tools,
    // TODO: surface stopWhen tuning once we gather additional telemetry from longer stories.
    stopWhen: stepCountIs(
      Math.max(1, (options.maxSteps ?? DEFAULT_MAX_STEPS) + 1),
    ),
    output: Output.object({ schema: storyTestResultSchema }),
  })

  const prompt = buildStoryEvaluationPrompt(options)
  const result = await agent.generate({ prompt })

  const parsedOutput = storyTestResultSchema.parse(result.output)
  const stepSummaries = summarizeAgentSteps(result.steps)
  const toolTrace = extractToolTrace(result.steps)

  const agentMetadata: Record<string, JSONValue> = {
    modelId: effectiveModelId,
    finishReason: result.finishReason,
    stepCount: result.steps.length,
    toolInvocations: structuredClone(toolTrace) as unknown as JSONValue,
    initialSnippetCount: options.initialSnippets?.length ?? 0,
  }

  const enhancedMetadata = mergeMetadata(parsedOutput.metadata, {
    agent: agentMetadata as JSONValue,
  })

  const rawOutput =
    parsedOutput.rawOutput ??
    (structuredClone({
      text: result.text,
      reasoning: result.reasoning,
    }) as unknown as JSONValue)

  const outputWithMetadata: StoryTestModelOutput = {
    ...parsedOutput,
    metadata: enhancedMetadata,
    rawOutput,
  }

  return {
    output: outputWithMetadata,
    stepSummaries,
    toolTrace,
    finishReason: result.finishReason,
  }
}
