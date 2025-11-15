import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'
import { agents, generateText } from '@app/agents'
import { parseEnv } from '@app/config'
import { createDaytonaSandbox } from '../helpers/daytona'
import { getTelemetryTracer } from '@/telemetry'
import type { DecompositionAgentResult } from '@app/agents'
import { invalidateCacheForStory } from '@app/cache'

interface DecompositionPayload {
  /** A raw user story written in Gherkin or natural language */
  story: {
    id?: string
    text: string
    /** Story title - empty string if needs to be generated */
    title?: string
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
      // Generate title if empty and save it immediately
      if (story.id && (!story.title || story.title.trim() === '')) {
        const generatedTitle = await generateText({
          prompt: `Generate a concise, descriptive sentence (maximum 60 characters) for this user story:

${story.text}

The sentence should be clear, specific, and capture the essence of what the story is about. Use sentence case (only capitalize the first word and proper nouns), not title case. Return only the sentence, no additional text.`,
          modelId: 'gpt-4o-mini',
        })

        // Save the generated title immediately
        await db
          .updateTable('stories')
          .set({ name: generatedTitle.replace(/^["']|["']$/g, '') })
          .where('id', '=', story.id)
          .execute()

        logger.info('Generated and saved story title', {
          storyId: story.id,
          title: generatedTitle,
        })
      }

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
        // Get existing decomposition to check if it changed
        const existingStory = await db
          .selectFrom('stories')
          .select('decomposition')
          .where('id', '=', story.id)
          .executeTakeFirst()

        const newDecomposition = JSON.stringify(decompositionResult)
        const decompositionChanged =
          !existingStory ||
          existingStory.decomposition === null ||
          JSON.stringify(existingStory.decomposition) !== newDecomposition

        await db
          .updateTable('stories')
          .set({
            decomposition: newDecomposition,
          })
          .where('id', '=', story.id)
          .execute()

        // Invalidate cache if decomposition changed
        if (decompositionChanged) {
          // TODO we may not want to delete cache... not sure.
          await invalidateCacheForStory({
            db,
            storyId: story.id,
          })

          logger.info('Invalidated cache due to decomposition change', {
            storyId: story.id,
          })
        }
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
