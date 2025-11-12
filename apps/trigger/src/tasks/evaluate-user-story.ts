import { task, logger } from '@trigger.dev/sdk'
import { z } from 'zod'

import { setupDb } from '@app/db'
import {
  parseEnv,
  runStoryStepDecomposerAgent,
  type StoryStepDecomposerAgentResult,
} from '@app/agents'
import { getTelemetryTracer } from '@/telemetry'

const payloadSchema = z.object({
  story: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: 'story cannot be empty',
    }),
  slug: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.includes('/'), {
      message: 'slug must be in the format owner/repo',
    }),
})

function splitSlug(slug: string): { ownerLogin: string; repoName: string } {
  const [ownerLoginRaw, repoNameRaw, ...rest] = slug.split('/')

  if (!ownerLoginRaw || !repoNameRaw || rest.length > 0) {
    throw new Error(`Invalid slug "${slug}". Expected format owner/repo.`)
  }

  const ownerLogin = ownerLoginRaw.trim()
  const repoName = repoNameRaw.trim()

  if (ownerLogin.length === 0 || repoName.length === 0) {
    throw new Error(`Invalid slug "${slug}". Expected non-empty owner and repo.`)
  }

  return { ownerLogin, repoName }
}

export const evaluateUserStoryTask = task({
  id: 'evaluate-user-story',
  run: async (rawPayload: unknown) => {
    const payload = payloadSchema.parse(rawPayload)

    const { ownerLogin, repoName } = splitSlug(payload.slug)

    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    const repoRecord = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.name as repoName',
        'repos.description as repoDescription',
        'repos.defaultBranch as defaultBranch',
        'owners.login as ownerLogin',
      ])
      .where('owners.login', '=', ownerLogin)
      .where('repos.name', '=', repoName)
      .executeTakeFirst()

    if (!repoRecord) {
      throw new Error(`Repository not found for slug "${payload.slug}"`)
    }

    const telemetryTracer = getTelemetryTracer()

    const agentResult: StoryStepDecomposerAgentResult =
      await runStoryStepDecomposerAgent({
        story: payload.story,
        repoFullName: `${repoRecord.ownerLogin}/${repoRecord.repoName}`,
        repoDescription: repoRecord.repoDescription,
        repoDefaultBranch: repoRecord.defaultBranch,
        telemetryTracer,
      })

    logger.info('🧾 Story decomposed', {
      slug: payload.slug,
      steps: agentResult.steps.length,
      finishReason: agentResult.finishReason,
      stepCount: agentResult.metrics.stepCount,
      toolCalls: agentResult.metrics.toolCallCount,
    })

    return {
      steps: agentResult.steps,
    }
  },
})
