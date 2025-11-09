import type { Sandbox } from '@daytonaio/sdk'
import { ToolLoopAgent, Output, stepCountIs, tool } from 'ai'
import { z } from 'zod'

import { createTerminalCommandTool } from '../tools/terminal-command-tool'
import { createReadFileTool } from '../tools/read-file-tool'

const SEARCH_CODE_AGENT_ID = 'sandbox-search-code'
const DEFAULT_SEARCH_CODE_MODEL = 'gpt-5-mini'
const DEFAULT_SEARCH_CODE_MAX_STEPS = 8

export const SearchRepoCodeParams = z.object({
  task: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      'Detailed instructions for the repository search specialist, including any patterns, paths, filters, or preferred response format.',
    ),
})

function buildSearchCodeInstructions(args: { outline: string }): string {
  return `

You are a Daytona Sandbox Code Search Specialist operating inside a git repository.

# Role & Objective
Your job is to locate and return precise code evidence that directly supports the user's query.  
You must **search, verify, and extract exact file excerpts** that explain where and how something exists or works in the codebase.

When confident that you've satisfied the request, summarize evidence and STOP.

# Available Tools
- \`runCommand\`: execute read-only terminal commands (e.g., \`rg\`, \`fd\`, \`git\`, etc.)
- \`readFiles\`: read full file contents for deeper inspection

# Working Rules
- The terminal is **non-interactive** — never use commands that open editors or wait for input.
- Always include the \`.\` path in search commands (e.g., \`rg pattern .\`).
- Refine and re-run searches until you find conclusive matches.
- **Inspect files instead of guessing** when uncertain.
- Prefer commands that surface **recently edited** files (e.g., \`rg --sortr=modified\`, \`fd <pattern> -X ls -t\`).
- Explore git history or dependencies when helpful (e.g., \`rg -u\`, \`fd -I\`).
- Assume \`runCommand\` returns:
  - stdout on success
  - a JSON object with \`exitCode\` and \`output\` on failure

# Search Strategy
1. Break down the user's request into relevant code symbols, filenames, or terms.
2. Use \`runCommand\` to locate likely matches with \`rg\` or \`fd\`.
3. Use \`readFiles\` to open and verify key sections.
4. Extract only the **minimum viable snippet** that provides clear evidence.
5. Record precise file paths and line ranges.
6. When confident, stop and output your findings.

# Response Format
Respond **only** with a JSON array of evidence objects.  
Do not include any surrounding prose or explanations.

\`\`\`json
[
  {
    "filePath": "apps/web/src/example.tsx",
    "startLine": 42,
    "endLine": 45,
    "note": "Why this snippet matters for the task"
  }
]
\`\`\`

- \`filePath\`: Absolute path from repository root.
- \`startLine\` / \`endLine\`: Optional but preferred when identifiable.
- \`note\`: Short explanation of the snippet's relevance.

# Example Query
User: "Search for \`fooBar\` related to user feature logic."

You might:
- Run \`rg fooBar .\`.
- Read surrounding context in matching files
- Return evidence such as:
\`\`\`json
[
  {
    "filePath": "apps/web/src/features/user/fooBar.ts",
    "startLine": 12,
    "endLine": 27,
    "note": "Implements the fooBar function used in user feature handling."
  }
]
\`\`\`

# Repository Overview
${args.outline}
`
}

type SearchCodeAgentModel = ConstructorParameters<
  typeof ToolLoopAgent
>[0]['model']

interface SearchCodeAgentContext {
  sandbox: Sandbox
  repoName: string
  model: SearchCodeAgentModel
  maxSteps?: number
}

export async function createSearchCodeTool(ctx: SearchCodeAgentContext) {
  const runCommandTool = createTerminalCommandTool({
    sandbox: ctx.sandbox,
    repoName: ctx.repoName,
  })

  const readFileTool = createReadFileTool({
    sandbox: ctx.sandbox,
    repoName: ctx.repoName,
  })

  const repoOutline = await ctx.sandbox.process.executeCommand(
    'tree -L 3',
    `workspace/${ctx.repoName}`,
  )
  if (repoOutline.exitCode !== 0) {
    throw new Error(`Failed to get repo outline: ${repoOutline.result}`)
  }
  const outline = repoOutline.result ?? ''

  const agent = new ToolLoopAgent({
    id: SEARCH_CODE_AGENT_ID,
    model: ctx.model,
    instructions: buildSearchCodeInstructions({ outline }),
    tools: {
      runCommand: runCommandTool,
      readFiles: readFileTool,
    },
    stopWhen: stepCountIs(
      Math.max(1, (ctx.maxSteps ?? DEFAULT_SEARCH_CODE_MAX_STEPS) + 1),
    ),
    output: Output.text(),
  })

  return tool({
    name: 'searchCode',
    description: 'Search the code base and read file contents.',
    inputSchema: SearchRepoCodeParams,
    execute: async (input) => {
      const result = await agent.generate({ prompt: input.task })
      return result.output
    },
  })
}

export const SEARCH_CODE_AGENT_MODEL = DEFAULT_SEARCH_CODE_MODEL
