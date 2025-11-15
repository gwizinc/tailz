import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import type { Tracer } from '@opentelemetry/api'

import { getDaytonaSandbox } from '../../helpers/daytona'
import { createTerminalCommandTool } from '../../tools/terminal-command-tool'
import { createReadFileTool } from '../../tools/read-file-tool'
import { createResolveLibraryTool } from '../../tools/context7-tool'
import { createLspTool } from '../../tools/lsp-tool'
import { agents } from '../../index'
import zodToJsonSchema from 'zod-to-json-schema'
import { logger } from '@trigger.dev/sdk'
import {
  decompositionOutputSchema,
  type DecompositionOutput,
} from '@app/schemas'

export type DecompositionAgentResult = DecompositionOutput

type DecompositionAgentOptions = {
  story: {
    /** Optional because we can test decomposition with just the text alone */
    id?: string
    text: string
  }
  repo: {
    id: string
    slug: string
  }
  options: {
    daytonaSandboxId: string
    telemetryTracer?: Tracer
    maxSteps?: number
    modelId?: string
  }
}

function buildDecompositionInstructions(): string {
  return `You are an expert software QA analyst tasked with interpreting a plain-language user story into a **context-aware, stateful sequence of verifiable behavioral steps**.

# 🎯 Objective
Translate the provided story into a structured list of **testable assertions** that describe what must be true for the story to be valid.

Each step:
- Represents a factual state transition in the user experience or system behavior.
- May rely on previously established context or variables.
- Updates the shared environment for subsequent steps.

# Evaluation Mindset
Think like a QA engineer reasoning through both behavior and domain state.
Stay within the bounds of the user story itself.
DO NOT add additional requirements or assertions unless they are explicitly stated in the original user story.

# Resources Available
You have read-only tools to:
- Explore repository structure and contents.
- Inspect function/class/type names and symbol usage.

> Use these tools to resolve ambiguous statements in the story wherein researching source code would assist with understanding intent.

# Output Guidelines
- Use concise, domain-agnostic phrasing.
- Each step should be independently verifiable and logically dependent on its preconditions.
- Assertions should be declarative statements that can be verified.
- Avoid redundancy: once a fact is established, reference it rather than restate it.
- Maintain causal flow — every step transitions from one valid state to the next.
- **Never** include source code nor pseudocode.

**Good Example Assertions:**
- A user is signed in with an active session.
- The user can create a new discussion thread.
- The new thread is labeled as an AI thread.
- New messages appear in the thread, to the user immediately.
- The thread owner references the signed-in user.

**Bad Example Assertions (don't do this):**
- Using jargon or syntax like \`U\` for authenticated user
- Using syntax like \`T.state = active && M.thread = T\`
- Using property names like \`Thread.owner\`

# Output Schema
\`\`\`json
${JSON.stringify(zodToJsonSchema(decompositionOutputSchema), null, 2)}
\`\`\`

# Goal
Produce a causal, stateful sequence of steps that reflects both **user experience** and **system truth**, where each step's assertions enrich a shared, object-oriented context.  
This output can be executed by a reasoning agent to simulate the logical progression of the story from start to finish.
`
}

function buildDecompositionPrompt(story: string): string {
  return `User Story:
${story}

Decompose this story and break it down into a sequential list of steps. Each step should be either:
- A "given" precondition that must be true before evaluating requirements
- A "requirement" with an outcome and assertions describing what becomes true

When your decomposition is complete, respond only with the JSON object that matches the schema.`
}

export async function runDecompositionAgent({
  story,
  repo,
  options,
}: DecompositionAgentOptions): Promise<DecompositionAgentResult> {
  const sandbox = await getDaytonaSandbox(options.daytonaSandboxId)

  const agent = new Agent({
    model: agents.decomposition.options.model,
    system: buildDecompositionInstructions(),
    tools: {
      terminalCommand: createTerminalCommandTool({ sandbox }),
      readFile: createReadFileTool({ sandbox }),
      resolveLibrary: createResolveLibraryTool(),
      lsp: createLspTool({ sandbox }),
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'story-decomposition-v3',
      metadata: {
        ...(story.id && { storyId: story.id }),
        repoId: repo.id,
        repoSlug: repo.slug,
        daytonaSandboxId: options.daytonaSandboxId,
        modelId: options.modelId ?? 'gpt-5-mini',
      },
      tracer: options.telemetryTracer,
    },
    stopWhen: stepCountIs(
      options.maxSteps ?? agents.decomposition.options.maxSteps,
    ),
    experimental_output: Output.object({ schema: decompositionOutputSchema }),
  })

  const prompt = buildDecompositionPrompt(story.text)

  const result = await agent.generate({ prompt })

  logger.debug('🤖 Story Decomposition Agent Result', { result })

  return result.experimental_output
}
