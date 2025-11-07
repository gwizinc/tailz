import { task } from '@trigger.dev/sdk'

import {
  runStoryEvaluationAgent,
  type StoryEvaluationAgentResult,
} from '../agents/story-evaluator'

interface RunStoryEvaluationPayload {
  storyName: string
  storyText: string
  repoId: string
  repoName: string
  branchName?: string | null
  commitSha?: string | null
  runId?: string | null
  maxSteps?: number
}

// * Just a wrapper to keep things simple
export async function runStoryEvaluation(
  payload: RunStoryEvaluationPayload,
): Promise<StoryEvaluationAgentResult> {
  console.log('payload', payload)
  return await runStoryEvaluationAgent({
    storyName: payload.storyName,
    storyText: payload.storyText,
    repoId: payload.repoId,
    repoName: payload.repoName,
    branchName: payload.branchName,
    commitSha: payload.commitSha,
    runId: payload.runId,
    maxSteps: payload.maxSteps,
  })
}

export const runStoryEvaluationTask = task({
  id: 'run-story-evaluation',
  run: runStoryEvaluation,
})
