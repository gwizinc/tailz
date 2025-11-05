import { task, logger } from '@trigger.dev/sdk'
import type { StoryTestResult } from '../types'

export const testStoryTask = task({
  id: 'test-story',
  run: async (
    payload: {
      storyId: string
      storyName: string
      story: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Testing story', {
      storyId: payload.storyId,
      storyName: payload.storyName,
    })

    // TODO: Implement actual story testing (headless browser in future)
    await Promise.resolve()

    const result: StoryTestResult = {
      storyId: payload.storyId,
      status: 'pass',
    }

    logger.info('Story test completed', {
      storyId: payload.storyId,
      status: result.status,
    })

    return result
  },
})
