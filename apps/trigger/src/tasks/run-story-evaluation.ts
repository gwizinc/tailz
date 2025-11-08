/* eslint-disable @typescript-eslint/no-unsafe-call */
import { task, logger } from '@trigger.dev/sdk'

import {
  runStoryEvaluationAgent,
  type StoryEvaluationAgentResult,
  setAgentLogger,
} from '@app/agents'

interface RunStoryEvaluationPayload {
  storyName: string
  storyText: string
  repoId: string
  repoName: string
  branchName: string
  commitSha?: string | null
  runId?: string | null
  maxSteps?: number
}

// * Just a wrapper to keep things simple
async function runStoryEvaluation(
  payload: RunStoryEvaluationPayload,
): Promise<StoryEvaluationAgentResult> {
  setAgentLogger(logger)
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
