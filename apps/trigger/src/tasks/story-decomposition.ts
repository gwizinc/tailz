import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'
import { parseEnv, runStoryDecompositionAgent } from '@app/agents'
import { createDaytonaSandbox } from '../helpers/daytona'
import { getTelemetryTracer } from '@/telemetry'

interface StoryDecompositionPayload {
  /** A raw user story written in Gherkin or natural language */
  story: {
    id: string
    text: string
  }
  /** Identifier for the repository in {owner}/{repo} format */
  repo: {
    id: string
    slug: string
    /** Branch name to clone (defaults to 'main') */
    branchName?: string
  }
}

export const storyDecompositionTask = task({
  id: 'story-decomposition',
  run: async ({ story, repo }: StoryDecompositionPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    const [ownerLogin, repoName] = repo.slug.split('/')
    const branchName = repo.branchName ?? 'main'

    // Retrieve the repository record (read-only access)
    const repoRecord = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select(['repos.id as repoId', 'repos.name as repoName'])
      .where('owners.login', '=', ownerLogin)
      .where('repos.name', '=', repoName)
      .executeTakeFirst()

    if (!repoRecord) {
      throw new Error(
        `Repository not found: ${repo.slug}. Make sure the repository exists in the database.`,
      )
    }

    // Create the sandbox and clone the repository
    const sandbox = await createDaytonaSandbox({
      repoId: repoRecord.repoId,
      branchName,
    })

    try {
      // Run the story decomposition agent
      const decompositionResult = await runStoryDecompositionAgent({
        story,
        repo,
        options: {
          daytonaSandboxId: sandbox.id,
          telemetryTracer: getTelemetryTracer(),
        },
      })

      logger.info('Story decomposition completed', {
        slug: repo.slug,
        stepCount: decompositionResult.stepCount,
        toolCallCount: decompositionResult.toolCallCount,
        stepsCount: decompositionResult.steps.length,
      })

      // Return the structured output (no side effects)
      return {
        steps: decompositionResult.steps,
      }
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
