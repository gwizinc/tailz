/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { MCP_API_TOKEN } from 'astro:env/server'
import type { APIRoute } from 'astro'
import { z } from 'zod'

import {
  DEFAULT_RESULT_LIMIT,
  MAX_RESULT_LIMIT,
  runStoryEvaluationAgent,
  semanticCodeSearch,
  semanticSearchInputSchema,
  symbolLookup,
  symbolLookupInputSchema,
} from '@app/agents'

export const prerender = false

interface JsonRpcRequest {
  jsonrpc: string
  id?: string | number | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcRequest['id']
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

const contextSchema = z.object({
  repoId: z.string().min(1),
  branch: z.string().min(1),
})

const callToolSchema = z.object({
  name: z.enum(['semanticCodeSearch', 'symbolLookup']),
  context: contextSchema,
  arguments: z.object({}).passthrough().optional(),
})

const storyAgentSchema = z.object({
  agent: z.literal('story-evaluation'),
  storyName: z.string().min(1),
  storyText: z.string().min(1),
  repoId: z.string().min(1),
  repoName: z.string().min(1),
  branchName: z.string().min(1),
  commitSha: z.string().optional().nullable(),
  runId: z.string().optional().nullable(),
  maxSteps: z.number().int().positive().optional(),
  modelId: z.string().min(1).optional(),
})

function makeResponse(body: JsonRpcResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function makeError(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  data?: unknown,
  status = 400,
): Response {
  return makeResponse(
    {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    },
    status,
  )
}

function authenticate(
  request: Request,
): { ok: true } | { ok: false; reason: string } {
  const token = MCP_API_TOKEN

  if (!token || token.length === 0) {
    return { ok: false, reason: 'MCP_API_TOKEN is not configured' }
  }

  const authorization = request.headers.get('authorization')
  if (authorization && authorization.startsWith('Bearer ')) {
    const provided = authorization.slice('Bearer '.length).trim()
    if (provided === token) {
      return { ok: true }
    }
  }

  const fallback = request.headers.get('x-api-token')
  if (fallback && fallback === token) {
    return { ok: true }
  }

  return { ok: false, reason: 'Invalid or missing API token' }
}

function listTools() {
  return [
    {
      name: 'semanticCodeSearch',
      description:
        'Retrieve relevant repository files and code snippets using semantic search.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            minLength: 1,
            maxLength: 8000,
            description: 'Semantic search query for repository code.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_RESULT_LIMIT,
            default: DEFAULT_RESULT_LIMIT,
            description: 'Maximum number of files to return.',
          },
          extType: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            nullable: true,
            description: 'Optional file extension filter (e.g. ts, tsx, py).',
          },
        },
      },
      context: {
        type: 'object',
        required: ['repoId', 'branch'],
        properties: {
          repoId: {
            type: 'string',
            description: 'Repository identifier from Tailz.',
          },
          branch: { type: 'string', description: 'Branch name to query.' },
        },
      },
    },
    {
      name: 'symbolLookup',
      description:
        'Locate code symbols or identifiers and return surrounding context lines.',
      inputSchema: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            description: 'Code symbol or identifier to locate.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_RESULT_LIMIT,
            default: DEFAULT_RESULT_LIMIT,
            description: 'Maximum number of files to inspect.',
          },
          surroundingLines: {
            type: 'integer',
            minimum: 0,
            maximum: 50,
            default: 3,
            description: 'Number of context lines before and after each match.',
          },
          extType: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            nullable: true,
            description: 'Optional file extension filter.',
          },
        },
      },
      context: {
        type: 'object',
        required: ['repoId', 'branch'],
        properties: {
          repoId: {
            type: 'string',
            description: 'Repository identifier from Tailz.',
          },
          branch: { type: 'string', description: 'Branch name to query.' },
        },
      },
    },
  ]
}

function listAgents() {
  return [
    {
      id: 'story-evaluation',
      name: 'Story Evaluation Agent',
      description:
        'Evaluates user stories against the indexed repository using semantic search and symbol lookup tools.',
      inputSchema: {
        type: 'object',
        required: [
          'storyName',
          'storyText',
          'repoId',
          'repoName',
          'branchName',
        ],
        properties: {
          storyName: {
            type: 'string',
            description: 'Human readable name for the story being evaluated.',
          },
          storyText: {
            type: 'string',
            description: 'Full user story text or acceptance criteria.',
          },
          repoId: {
            type: 'string',
            description:
              'Repository identifier that matches the Tailz database.',
          },
          repoName: {
            type: 'string',
            description:
              'Repository slug used for telemetry and agent prompts.',
          },
          branchName: {
            type: 'string',
            description: 'Branch name to read semantic index data from.',
          },
          commitSha: {
            type: 'string',
            nullable: true,
            description: 'Optional commit SHA for logging or traceability.',
          },
          runId: {
            type: 'string',
            nullable: true,
            description: 'Optional run identifier to correlate results.',
          },
          maxSteps: {
            type: 'integer',
            minimum: 1,
            description: 'Optional override for the maximum agent steps.',
          },
          modelId: {
            type: 'string',
            description: 'Optional override for the model identifier.',
          },
        },
      },
    },
  ]
}

async function handleCallTool(
  id: JsonRpcRequest['id'],
  params: unknown,
): Promise<Response> {
  const parsed = callToolSchema.safeParse(params)
  if (!parsed.success) {
    return makeError(
      id,
      -32602,
      'Invalid tool parameters',
      parsed.error.flatten(),
    )
  }

  const { name, context, arguments: rawArgs } = parsed.data
  const args = rawArgs ?? {}

  try {
    switch (name) {
      case 'semanticCodeSearch': {
        const parsedArgs = semanticSearchInputSchema.parse(args)
        const hits = await semanticCodeSearch({
          ...context,
          ...parsedArgs,
        })

        return makeResponse({ jsonrpc: '2.0', id, result: { hits } })
      }
      case 'symbolLookup': {
        const parsedArgs = symbolLookupInputSchema.parse(args)
        const hits = await symbolLookup({
          ...context,
          ...parsedArgs,
        })

        return makeResponse({ jsonrpc: '2.0', id, result: { hits } })
      }
      default:
        return makeError(id, -32601, `Tool ${name} is not available`)
    }
  } catch (error) {
    if (error instanceof Error) {
      return makeError(id, -32002, error.message, undefined, 500)
    }

    return makeError(id, -32002, 'Unknown error invoking tool', undefined, 500)
  }
}

async function handleCallAgent(
  id: JsonRpcRequest['id'],
  params: unknown,
): Promise<Response> {
  const parsed = storyAgentSchema.safeParse(params)
  if (!parsed.success) {
    return makeError(
      id,
      -32602,
      'Invalid agent parameters',
      parsed.error.flatten(),
    )
  }

  const { agent, ...rest } = parsed.data

  if (agent !== 'story-evaluation') {
    return makeError(id, -32601, `Agent ${agent} is not available`)
  }

  try {
    const result = await runStoryEvaluationAgent({
      storyName: rest.storyName,
      storyText: rest.storyText,
      repoId: rest.repoId,
      repoName: rest.repoName,
      branchName: rest.branchName,
      commitSha: rest.commitSha ?? null,
      runId: rest.runId ?? null,
      maxSteps: rest.maxSteps,
      modelId: rest.modelId,
    })

    return makeResponse({ jsonrpc: '2.0', id, result })
  } catch (error) {
    if (error instanceof Error) {
      return makeError(id, -32003, error.message, undefined, 500)
    }

    return makeError(id, -32003, 'Unknown error invoking agent', undefined, 500)
  }
}

export const ALL: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 })
  }

  const auth = authenticate(request)
  if (!auth.ok) {
    return makeError(null, -32000, auth.reason, undefined, 401)
  }

  let payload: JsonRpcRequest
  try {
    payload = (await request.json()) as JsonRpcRequest
  } catch (error) {
    return makeError(
      null,
      -32700,
      'Failed to parse JSON body',
      error instanceof Error ? error.message : undefined,
    )
  }

  if (payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
    return makeError(payload.id ?? null, -32600, 'Invalid JSON-RPC request')
  }

  switch (payload.method) {
    case 'list_tools':
      return makeResponse({
        jsonrpc: '2.0',
        id: payload.id ?? null,
        result: listTools(),
      })
    case 'call_tool':
      return await handleCallTool(payload.id ?? null, payload.params)
    case 'list_agents':
      return makeResponse({
        jsonrpc: '2.0',
        id: payload.id ?? null,
        result: listAgents(),
      })
    case 'call_agent':
      return await handleCallAgent(payload.id ?? null, payload.params)
    default:
      return makeError(
        payload.id ?? null,
        -32601,
        `Method ${payload.method} not found`,
        undefined,
        404,
      )
  }
}
