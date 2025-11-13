import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'
import { agents } from '@app/agents'
import { parseEnv } from '@app/config'
import { createDaytonaSandbox } from '../helpers/daytona'
import { getTelemetryTracer } from '@/telemetry'
import type { DecompositionAgentResult } from 'node_modules/@app/agents/src/agents/v3/story-decomposition'

interface DecompositionPayload {
  /** A raw user story written in Gherkin or natural language */
  story: {
    id?: string
    text: string
  }
  /** Identifier for the repository in {owner}/{repo} format */
  repo: {
    id: string
    slug: string
  }
}

export const storyDecompositionTask = task({
  id: 'story-decomposition',
  run: async ({
    story,
    repo,
  }: DecompositionPayload): Promise<DecompositionAgentResult> => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    // Create the sandbox and clone the repository
    const sandbox = await createDaytonaSandbox({ repoId: repo.id })

    try {
      // Run the story decomposition agent
      const decompositionResult = await agents.decomposition.run({
        story,
        repo,
        options: {
          daytonaSandboxId: sandbox.id,
          telemetryTracer: getTelemetryTracer(),
        },
      })

      // Save decomposition results to the story record if story.id exists
      if (story.id) {
        await db
          .updateTable('stories')
          .set({
            decomposition: JSON.stringify(decompositionResult),
          })
          .where('id', '=', story.id)
          .execute()
      }

      // Return the structured output
      return decompositionResult
    } catch (error) {
      logger.error('Story decomposition failed', {
        story,
        repo,
        error,
      })
      throw error
    } finally {
      await sandbox.delete()
    }
  },
})
