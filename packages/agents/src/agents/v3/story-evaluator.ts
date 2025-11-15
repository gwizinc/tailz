import { ToolLoopAgent, Output, stepCountIs, generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { DecompositionAgentResult } from './story-decomposition'
import dedent from 'dedent'

import { parseEnv } from '@app/config'
import { getDaytonaSandbox } from '../../helpers/daytona'
import { createTerminalCommandTool } from '../../tools/terminal-command-tool'
import { createReadFileTool } from '../../tools/read-file-tool'
import {
  createResolveLibraryTool,
  createGetLibraryDocsTool,
} from '../../tools/context7-tool'
import { createLspTool } from '../../tools/lsp-tool'
import {
  type Status,
  analysisSchema,
  type EvaluationAnalysisResult,
} from '@app/schemas'
import type { evaluationAgentOptions } from '../schema'
import { logger } from '@trigger.dev/sdk'
import zodToJsonSchema from 'zod-to-json-schema'
import { agents } from '../..'
import { z } from 'zod'

/**
 * Schema for agent output (step evaluation result)
 */
const stepAgentOutputSchema = z.object({
  conclusion: z.enum(['pass', 'fail']),
  outcome: z.string().min(1),
  assertions: z.array(
    z.object({
      fact: z.string().min(1),
      evidence: z.array(
        z
          .string()
          .min(1)
          .describe('file:line-range only eg., src/auth/session.ts:12-28'),
      ),
    }),
  ),
})

type StepAgentOutput = z.infer<typeof stepAgentOutputSchema>

// Type definitions
type StepContext = {
  stepIndex: number
  step: DecompositionAgentResult['steps'][number]
  previousResults: StepAgentOutput[]
  storyName: string
  storyText: string
  repoOutline: string
}

// Functions
function buildEvaluationInstructions(repoOutline: string): string {
  return `
You are an expert software QA engineer evaluating whether a specific step from a user story is properly implemented given the current repository state.

# Role & Objective
You are evaluating a SINGLE step from a decomposed user story. Start with no assumptions that this step is implemented correctly. 
You must discover evidence by gathering, searching, and evaluating source code to make a well-educated conclusion about whether this specific step is properly and fully implemented.

# How to Perform Your Evaluation
1. Focus ONLY on the current step provided in the prompt.
2. Use the available tools to search for supporting code evidence for THIS step's assertions.
3. When you find relevant code, verify it by reading the file contents and understanding the context.
4. Record each piece of evidence with precise file paths and line ranges.
5. Consider context from previous steps if provided, but focus your evaluation on the current step.
6. Stop once you have enough verified evidence to reach a confident conclusion about each of THIS step's assertions.

# Mindset
- False-positives are worse than false-negatives.
- Treat the repository as the single source of truth.
- Only mark this step as "passed" when code evidence confirms it is implemented and functionally correct.
- When supporting code is missing, incomplete, or ambiguous, mark the step as "failed" and explain what is missing.
- Evidence must be **executable code**, not just type definitions, comments, or unused utilities.
- If previous step results are provided, you may reference their evidence but must verify the current step independently.
- When a step depends on another, you may reference previous step evidence but must still verify the current step's implementation.

# Tools
- **terminalCommand**: Execute read-only shell commands (e.g., \`rg\`, \`fd\`, \`tree\`, \`git\`, \`grep\`, etc.) to search for code patterns, files, and symbols.
- **readFile**: Read the full contents of a file to verify context and extract precise code snippets.
- **resolveLibrary**: Resolve a library/package name to get its Context7 library ID. Use this when you need to understand how a specific library or framework works.
- **getLibraryDocs**: Fetch up-to-date documentation for a library using its Context7 ID. Use this after resolveLibrary to get detailed documentation about APIs, patterns, or features.
- **lsp**: Use the Language Server Protocol to list symbols in a file (\`documentSymbols\`) or discover symbols across the codebase (\`sandboxSymbols\`). Only supports TypeScript and Python sources.

# Rules
- Always append a \`.\` when using \`rg\` (e.g., \`rg pattern .\`).
- When verifying code, read 10-20 lines before and after a match to confirm context if needed.
- Use \`resolveLibrary\` and \`getLibraryDocs\` only when local patterns are unclear: resolve the Context7 ID, fetch the docs, and apply them to your evaluation.
- Extract only the **minimum viable snippet** that provides clear evidence, recording precise file paths and line ranges.
- Stop once you have enough verified evidence to reach a confident conclusion.
- Explanation should clearly state why the story passes or fails. Use concise language that a human reviewer can follow quickly.
- Keep it short, factual, and time-ordered.
- Output summaries in Markdown format, embedded in the JSON object, so they render cleanly for humans.
- Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.
- Evidence MUST NOT come from test files, e.g., \`src/tests/...\` or \`src/test-utils.ts\`.

# Output Schema
\`\`\`
${JSON.stringify(zodToJsonSchema(stepAgentOutputSchema), null, 2)}
\`\`\`

# Repository Overview
Use this output to form an initial understanding of the repository layout, infer where relevant code might live, and guide your first searches.

${repoOutline}
`
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildStepPrompt({
  stepContext,
}: {
  stepContext: StepContext
}): string {
  // Collect facts (steps[].assertions[].fact)
  const facts = stepContext.previousResults.flatMap((prevResult) =>
    prevResult.assertions.map((assertion) => assertion.fact),
  )

  const givensSection =
    facts.length > 0
      ? dedent`
          # Verified Facts
          Use these already validated facts as givens in when evaluating the requirement below.
          ${bulletList(facts)}
        `
      : ''

  const requirementSection =
    stepContext.step.type === 'requirement'
      ? dedent`
          # Goal
          **${stepContext.step.goal}**

          To verify is this goal is acheivable you must verify the following assertion:
          ${bulletList(stepContext.step.assertions)}

          Do not come up with more assertions, this is the complete list to verify and provide evidence for.
        `
      : ''

  return dedent`
    ${givensSection}

    ${requirementSection}

    Respond only with the required JSON schema once evaluation is complete.
  `
}

async function combineStepResults(args: {
  decompositionSteps: DecompositionAgentResult
  analysisStepResults: StepAgentOutput[]
  modelId?: string
}): Promise<EvaluationAnalysisResult> {
  const { decompositionSteps, analysisStepResults, modelId } = args

  // Map decomposition steps with their corresponding analysis results
  const steps = decompositionSteps.steps.map((decompStep, index) => {
    const analysisResult = analysisStepResults[index]

    // Use the original outcome from the decomposition step
    const outcome =
      decompStep.type === 'given' ? decompStep.given : decompStep.goal

    return {
      type: decompStep.type,
      conclusion: analysisResult.conclusion,
      outcome,
      assertions: analysisResult.assertions,
    }
  })

  // Determine overall status based on step conclusions
  // Steps can only have 'pass' or 'fail' conclusions
  const status: Status = steps.every((step) => step.conclusion === 'pass')
    ? 'pass'
    : 'fail'

  // Generate concise explanation using OpenAI
  const env = parseEnv()
  const openAiProvider = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const effectiveModelId = modelId ?? agents.evaluation.options.model

  const stepSummary = steps
    .map((step, idx) => {
      const icon = step.conclusion === 'pass' ? '✅' : '❌'
      return `${icon} Step ${idx + 1} (${step.conclusion}): ${step.outcome}`
    })
    .join('\n')

  const { text: explanation } = await generateText({
    model: openAiProvider(effectiveModelId),
    prompt: dedent`
      You are summarizing the results of a story evaluation. Provide a very concise (2-3 sentences max) summary of the evaluation state.

Overall Status: ${status}

Step Results:
${stepSummary}

Provide a brief, user-friendly explanation of what this evaluation found. Focus on the key outcomes and any issues.`,
  })

  return analysisSchema.parse({
    version: 3,
    status,
    explanation,
    steps,
  })
}

/**
 * AI Agent that evaluates a single step from a user story
 */
async function agent(args: {
  stepContext: StepContext
  evaluationAgentOptions: evaluationAgentOptions
  sandbox: Awaited<ReturnType<typeof getDaytonaSandbox>>
}): Promise<StepAgentOutput> {
  const {
    stepContext,
    evaluationAgentOptions: { repo, options },
    sandbox,
  } = args
  const env = parseEnv()

  const aiProvider = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })
  const effectiveModelId = options?.modelId ?? agents.evaluation.options.model

  const agent = new ToolLoopAgent({
    id: 'story-step-evaluation-v3',
    model: aiProvider(effectiveModelId),
    instructions: buildEvaluationInstructions(stepContext.repoOutline),
    tools: {
      terminalCommand: createTerminalCommandTool({ sandbox }),
      readFile: createReadFileTool({ sandbox }),
      resolveLibrary: createResolveLibraryTool(),
      getLibraryDocs: createGetLibraryDocsTool(),
      lsp: createLspTool({ sandbox }),
    },
    toolChoice: 'required',
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'story-step-evaluation-v3',
      metadata: {
        storyName: stepContext.storyName,
        repoId: repo.id,
        repoSlug: repo.slug,
        daytonaSandboxId: options?.daytonaSandboxId ?? '',
        modelId: effectiveModelId,
        stepIndex: stepContext.stepIndex,
      },
      tracer: options?.telemetryTracer,
    },
    onStepFinish: (step) => {
      logger.info(`🤖 ai.onStepFinish`, step)
    },
    maxRetries: 1, // @default 2
    stopWhen: stepCountIs(
      options?.maxSteps ?? agents.evaluation.options.maxSteps,
    ),
    output: Output.object({ schema: stepAgentOutputSchema }),
  })

  const prompt = buildStepPrompt({ stepContext })

  const result = await agent.generate({ prompt })

  logger.log(`🌸 Step ${stepContext.stepIndex + 1} Evaluation Result`, {
    stepContext,
    prompt,
    result,
  })

  // Handle case where agent hit max steps without generating output
  if (!result.output) {
    const maxStepsUsed = options?.maxSteps ?? agents.evaluation.options.maxSteps
    logger.warn(
      `Step ${stepContext.stepIndex + 1} hit max steps (${maxStepsUsed}) without generating output`,
    )
    return {
      conclusion: 'fail' as const,
      outcome: `Evaluation stopped after reaching maximum steps (${maxStepsUsed}). The step may require more investigation or a higher step limit.`,
      assertions: [],
    }
  }

  return result.output
}

export async function main(
  payload: evaluationAgentOptions,
): Promise<EvaluationAnalysisResult> {
  const { story, options } = payload
  const sandbox = await getDaytonaSandbox(options?.daytonaSandboxId ?? '')

  // Get repository outline once for all steps
  const repoOutline = await sandbox.process.executeCommand(
    'tree -L 3 -I "dist|build|.git|.next|*.lock|*.log"',
    `workspace/repo`,
  )
  if (repoOutline.exitCode !== 0) {
    throw new Error(`Failed to get repo outline: ${repoOutline.result}`)
  }
  const outline = repoOutline.result ?? ''

  // Process each step sequentially
  const stepResults: StepAgentOutput[] = []
  const steps = story.decomposition.steps

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex]

    // Skip agent evaluation for 'given' steps - they are preconditions assumed to be true
    if (step.type === 'given') {
      const stepResult: StepAgentOutput = {
        conclusion: 'pass',
        outcome: step.given,
        assertions: [],
      }
      stepResults.push(stepResult)
      logger.info(
        `Skipping agent evaluation for given step ${stepIndex + 1} of ${steps.length}`,
        {
          step: step.given,
        },
      )
      continue
    }

    const stepContext: StepContext = {
      stepIndex,
      step,
      previousResults: [...stepResults],
      storyName: story.name,
      storyText: story.text,
      repoOutline: outline,
    }

    logger.info(`Evaluating step ${stepIndex + 1} of ${steps.length}`, {
      stepContext,
    })

    const stepResult = await agent({
      stepContext,
      evaluationAgentOptions: payload,
      sandbox,
    })

    stepResults.push(stepResult)

    // Early exit if a critical step fails
    // TODO: Determine if we should continue or stop on failure
    if (stepResult.conclusion === 'error') {
      logger.warn(`Step ${stepIndex + 1} encountered an error, continuing...`)
    }
  }

  // Combine all step results into final evaluation
  const finalResult = await combineStepResults({
    decompositionSteps: story.decomposition,
    analysisStepResults: stepResults,
    modelId: options?.modelId,
  })

  logger.debug('🤖 Evaluation Agent Final Result', {
    stepCount: stepResults.length,
    finalResult,
  })

  return finalResult
}
