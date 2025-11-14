import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'
import { parseEnv } from '@app/config'
import { storyDecompositionTask } from './story-decomposition'

export const decomposeAllStoriesTask = task({
  id: 'decompose-all-stories',
  run: async () => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    logger.info('Starting decomposition of all stories')

    // Query all non-archived stories with repo and owner information
    const stories = await db
      .selectFrom('stories')
      .innerJoin('repos', 'repos.id', 'stories.repoId')
      .innerJoin('owners', 'owners.id', 'repos.ownerId')
      .select([
        'stories.id as storyId',
        'stories.story as storyText',
        'stories.name as storyName',
        'repos.id as repoId',
        'repos.name as repoName',
        'owners.login as ownerLogin',
      ])
      .where('stories.archived', '=', false)
      .execute()

    logger.info(`Found ${stories.length} stories to decompose`)

    const results = {
      total: stories.length,
      triggered: 0,
      errors: 0,
      errorDetails: [] as Array<{ storyId: string; error: string }>,
    }

    // Trigger decomposition task for each story
    for (const story of stories) {
      try {
        await storyDecompositionTask.trigger({
          story: {
            id: story.storyId,
            text: story.storyText,
            title: story.storyName || '',
          },
          repo: {
            id: story.repoId,
            slug: `${story.ownerLogin}/${story.repoName}`,
          },
        })

        results.triggered++
        logger.info(`Triggered decomposition for story ${story.storyId}`)
      } catch (error) {
        results.errors++
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        results.errorDetails.push({
          storyId: story.storyId,
          error: errorMessage,
        })
        logger.error(
          `Failed to trigger decomposition for story ${story.storyId}`,
          {
            error,
          },
        )
      }
    }

    logger.info('Completed decomposition triggering', results)

    return results
  },
})
