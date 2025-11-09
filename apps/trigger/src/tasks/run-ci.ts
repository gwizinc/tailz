import { Daytona } from '@daytonaio/sdk'
import { logger, task, tasks } from '@trigger.dev/sdk'
import { json, setupDb, sql } from '@app/db'
import type { RunStory, StoryAnalysisV1 } from '@app/db'
import { parseEnv } from '@app/agents'
import { getGithubBranchDetails, getOctokitClient } from '../helpers/github'
import {
  buildCheckRunContent,
  formatStoryCount,
  submitCheckRun,
  type AggregatedCounts,
  type CheckRunBaseParams,
} from '../helpers/github-checks'

interface RunCiPayload {
  orgSlug: string
  repoName: string
  branchName?: string | null
}

type StoryRow = {
  id: string
  name: string
  story: string
  branchName: string
}

export const runCiTask = task({
  id: 'run-ci',
  run: async (payload: RunCiPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    /**
     * 💎 Get Repo Data
     */
    const repoRecord = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.id as repoId',
        'repos.defaultBranch as defaultBranch',
        'repos.name as repoName',
        'owners.login as ownerLogin',
      ])
      .where('owners.login', '=', payload.orgSlug)
      .where('repos.name', '=', payload.repoName)
      .executeTakeFirst()

    if (!repoRecord) {
      throw new Error(
        `Repository ${payload.orgSlug}/${payload.repoName} not found in database`,
      )
    }

    // TODO change to repo default in the future
    const branchName = payload.branchName?.trim() || 'main'

    logger.info(
      `👉 ${repoRecord.ownerLogin}/${repoRecord.repoName}#${branchName}`,
      { payload },
    )

    /**
     * 💎 Get Stories
     */
    const storiesQuery = db
      .selectFrom('stories')
      .select(['id', 'name', 'story', 'branchName'])
      .where('repoId', '=', repoRecord.repoId)
      .where('branchName', '=', branchName)

    const stories = (await storiesQuery.execute()) as StoryRow[]

    const initialRunStories: RunStory[] = stories.map((story) => ({
      storyId: story.id,
      status: 'running',
      resultId: null,
      startedAt: new Date().toISOString(),
      summary: null,
      completedAt: null,
    }))

    const runStatus = stories.length === 0 ? 'skipped' : 'running'
    const runSummary =
      stories.length === 0 ? 'No stories available for evaluation' : null

    const {
      repo,
      octokit,
      token: githubToken,
    } = await getOctokitClient(repoRecord.repoId)

    let commitSha: string | null = null
    let commitMessage: string | null = null

    try {
      const branchDetails = await getGithubBranchDetails(octokit, {
        owner: repoRecord.ownerLogin,
        repo: repoRecord.repoName,
        branch: branchName,
      })

      commitSha = branchDetails.commitSha
      commitMessage = branchDetails.commitMessage
    } catch (error) {
      logger.warn('Failed to fetch branch commit details', {
        repoId: repoRecord.repoId,
        branchName,
        error,
      })
    }

    /**
     * 💎 Create Run Record
     */
    const insertedRun = await sql<{ id: string; number: number }>`
      INSERT INTO public.runs (
        repo_id,
        branch_name,
        status,
        stories,
        commit_sha,
        commit_message,
        pr_number,
        summary
      ) VALUES (
        ${repoRecord.repoId},
        ${branchName},
        ${runStatus},
        ${JSON.stringify(initialRunStories)}::jsonb,
        ${commitSha},
        ${commitMessage},
        NULL,
        ${runSummary}
      )
      RETURNING id, number
    `.execute(db)

    const runInsert = insertedRun.rows[0]

    if (!runInsert) {
      throw new Error('Failed to create run record')
    }

    const runId = runInsert.id
    const baseUrl = env.SITE_BASE_URL
    const detailsUrl =
      baseUrl !== undefined
        ? `${baseUrl}/org/${repoRecord.ownerLogin}/${repoRecord.repoName}/runs/${runInsert.number}`
        : null

    const checkRunBase: CheckRunBaseParams | null =
      commitSha !== null
        ? {
            octokit,
            owner: repoRecord.ownerLogin,
            repo: repoRecord.repoName,
            headSha: commitSha,
            runId,
            runNumber: runInsert.number,
            branchName,
            detailsUrl,
          }
        : null

    let checkRunId: number | undefined

    if (checkRunBase) {
      const startContent = buildCheckRunContent({
        phase: 'start',
        runNumber: checkRunBase.runNumber,
        runId,
        branchName,
        summary:
          stories.length === 0
            ? 'No stories available for evaluation'
            : `Evaluating ${formatStoryCount(stories.length)}`,
        storyCount: stories.length,
      })

      try {
        checkRunId = await submitCheckRun({
          ...checkRunBase,
          content: startContent,
        })
      } catch (error) {
        logger.warn('Failed to create initial GitHub check run', {
          runId,
          error,
        })
      }
    } else {
      logger.warn(
        'Skipping GitHub check run creation due to missing commit SHA',
        {
          repoId: repoRecord.repoId,
          branchName,
        },
      )
    }

    logger.info('Created run record', {
      runId,
      repoId: repoRecord.repoId,
      branchName,
      storyCount: stories.length,
      commitSha,
      detailsUrl,
    })

    if (stories.length === 0) {
      const summaryText = 'No stories available for evaluation'

      if (checkRunBase) {
        const completionContent = buildCheckRunContent({
          phase: 'complete',
          runNumber: checkRunBase.runNumber,
          runId,
          branchName,
          status: 'skipped',
          summary: summaryText,
        })

        await submitCheckRun({
          ...checkRunBase,
          content: completionContent,
          existingCheckRunId: checkRunId,
        })
      }

      return {
        success: true,
        runId,
        runNumber: runInsert.number,
        status: 'skipped',
        summary: summaryText,
        stories: [],
      }
    }

    const daytona = new Daytona({
      apiKey: env.DAYTONA_API_KEY,
    })
    const repoUrl = `https://github.com/${repo.ownerLogin}/${repo.repoName}.git`
    const repoPath = `workspace/${repo.repoName}`

    let sandbox: Awaited<ReturnType<typeof daytona.create>> | null = null

    try {
      sandbox = await daytona.create({
        language: 'typescript',
        labels: {
          'tailz.repoId': repoRecord.repoId,
          'tailz.repo': `${repo.ownerLogin}/${repo.repoName}`,
          'tailz.runId': runId,
        },
      })

      logger.info(`🏎️ Daytona sandbox created`, {
        runId,
        sandboxId: sandbox.id,
        repo,
      })

      await sandbox.git.clone(
        repoUrl,
        repoPath,
        branchName,
        undefined,
        'x-access-token',
        githubToken,
      )

      // Remove token - just as a safe guard
      await sandbox.process.executeCommand(
        'rm -f ~/.git-credentials ~/.config/gh/hosts.yml || true',
      )

      /**
       * 💎 Run all stories in parallel
       */
      const batchResult = await tasks.batchTriggerAndWait(
        'test-story',
        stories.map((story) => ({
          payload: {
            storyId: story.id,
            runId,
            daytonaSandboxId: sandbox?.id,
          },
        })),
      )

      const updatedRunStories: RunStory[] = []

      const aggregated: AggregatedCounts = {
        pass: 0,
        fail: 0,
        blocked: 0,
      }

      /**
       * 💎 Aggregate Results
       */
      batchResult.runs.forEach((result, index) => {
        const story = stories[index]

        if (!story) {
          return
        }

        if (result.ok) {
          const output = result.output as {
            resultId: string
            status: 'pass' | 'fail' | 'blocked' | 'running'
            analysisVersion: number
            analysis: StoryAnalysisV1 | null
          }

          if (output.status === 'pass') {
            aggregated.pass += 1
          } else if (output.status === 'fail') {
            aggregated.fail += 1
          } else if (output.status === 'blocked') {
            aggregated.blocked += 1
          }

          updatedRunStories.push({
            storyId: story.id,
            status: output.status,
            resultId: output.resultId,
            // TODO use AI to summarize complete findings later.
            summary: null,
            startedAt: initialRunStories[index]?.startedAt ?? null,
            completedAt: new Date().toISOString(),
          })
        } else {
          aggregated.fail += 1
          const errorMessage =
            result.error &&
            typeof result.error === 'object' &&
            'message' in result.error &&
            typeof (result.error as { message?: unknown }).message === 'string'
              ? ((result.error as { message: string }).message ??
                'Evaluation failed')
              : 'Evaluation failed'
          updatedRunStories.push({
            storyId: story.id,
            status: 'fail',
            resultId: null,
            summary: errorMessage,
            startedAt: initialRunStories[index]?.startedAt ?? null,
            completedAt: new Date().toISOString(),
          })
        }
      })

      const totalStories = stories.length
      const summaryParts = [
        `${aggregated.pass} passed`,
        `${aggregated.fail} failed`,
        `${aggregated.blocked} blocked`,
      ]

      let finalStatus: 'pass' | 'fail' | 'skipped'
      if (aggregated.fail > 0 || aggregated.blocked > 0) {
        finalStatus = 'fail'
      } else if (aggregated.pass === totalStories) {
        finalStatus = 'pass'
      } else {
        finalStatus = 'skipped'
      }

      /**
       * 💎 Update Run Record
       */
      const summaryText = summaryParts.join(', ')

      await db
        .updateTable('runs')
        .set({
          status: finalStatus,
          summary: summaryText,
          stories: json(updatedRunStories),
        })
        .where('id', '=', runId)
        .execute()

      logger.debug('🙏 Completed run evaluation', {
        runId,
        finalStatus,
        summaryParts,
      })

      if (checkRunBase) {
        const completionContent = buildCheckRunContent({
          phase: 'complete',
          runNumber: checkRunBase.runNumber,
          runId,
          branchName,
          status: finalStatus,
          summary: summaryText,
          counts: aggregated,
        })

        await submitCheckRun({
          ...checkRunBase,
          content: completionContent,
          existingCheckRunId: checkRunId,
        })
      }

      /**
       * 💎 Return Results
       */
      return {
        success: true,
        runId,
        runNumber: runInsert.number,
        status: finalStatus,
        summary: summaryText,
        stories: updatedRunStories,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Run execution failed'

      logger.error('Run CI task failed', {
        runId,
        error,
      })

      await db
        .updateTable('runs')
        .set({
          status: 'fail',
          summary: errorMessage,
        })
        .where('id', '=', runId)
        .execute()

      if (checkRunBase) {
        const failureContent = buildCheckRunContent({
          phase: 'complete',
          runNumber: checkRunBase.runNumber,
          runId,
          branchName,
          status: 'fail',
          summary: errorMessage,
        })

        await submitCheckRun({
          ...checkRunBase,
          content: failureContent,
          existingCheckRunId: checkRunId,
        })
      }

      throw error
    } finally {
      if (sandbox) {
        const sandboxId = sandbox.id
        try {
          await sandbox.delete()
          logger.info('🏎️ Stopped Daytona sandbox', {
            runId,
            sandboxId,
          })
        } catch (error) {
          logger.error('🏎️ Failed to stop Daytona sandbox', {
            runId,
            sandboxId,
            error,
          })
        }
      }
    }
  },
})
