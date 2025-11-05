import type { CodebaseFile } from './fetch-codebase'
import { generateStories } from './generate-stories'

export interface DiscoverStoriesResult {
  success: boolean
  storyCount: number
  stories: Array<{ name: string; story: string; files: string[] }>
  error?: string
}

interface DiscoverStoriesParams {
  codebase: CodebaseFile[]
  apiKey: string
}

/**
 * Discovers stories from provided files or a diff-parsed file list.
 * The caller is responsible for sourcing files (full repo, commit, or PR).
 */
export async function discoverStories(
  params: DiscoverStoriesParams,
): Promise<DiscoverStoriesResult> {
  const { codebase, apiKey } = params

  try {
    if (codebase.length === 0) {
      return {
        success: false,
        storyCount: 0,
        stories: [],
        error: 'No code files found in repository',
      }
    }

    const generatedStories = await generateStories({ codebase, apiKey })

    if (generatedStories.length === 0) {
      return {
        success: true,
        storyCount: 0,
        stories: [],
        error: 'No stories were generated from the codebase',
      }
    }

    return {
      success: true,
      storyCount: generatedStories.length,
      stories: generatedStories,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      success: false,
      storyCount: 0,
      stories: [],
      error: errorMessage,
    }
  }
}
