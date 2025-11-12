import { Daytona } from '@daytonaio/sdk'
import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'
import { parseEnv, runStoryAnalysisAgent } from '@app/agents'
import { getOctokitClient } from '../../helpers/github'

type DaytonaClient = InstanceType<typeof Daytona>
type DaytonaSandbox = Awaited<ReturnType<DaytonaClient['create']>>

interface EvaluateUserStoryPayload {
  /** A raw user story written in Gherkin or natural language */
  story: string
  /** Identifier for the repository in {owner}/{repo} format */
  slug: string
  /** Optional branch name (defaults to repository's default branch) */
  branchName?: string | null
}

export const evaluateUserStoryTask = task({
  id: 'evaluate-user-story',
  run: async (payload: EvaluateUserStoryPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    // Parse slug into owner and repo name
    const slugParts = payload.slug.split('/')
    if (slugParts.length !== 2) {
      throw new Error(
        `Invalid slug format: "${payload.slug}". Expected format: "owner/repo"`,
      )
    }

    const [ownerLogin, repoName] = slugParts

    // Retrieve the repository record (read-only access)
    const repoRecord = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.id as repoId',
        'repos.name as repoName',
        'repos.defaultBranch as defaultBranch',
      ])
      .where('owners.login', '=', ownerLogin)
      .where('repos.name', '=', repoName)
      .executeTakeFirst()

    if (!repoRecord) {
      throw new Error(
        `Repository not found: ${payload.slug}. Make sure the repository exists in the database.`,
      )
    }

    const branchName = payload.branchName?.trim() || repoRecord.defaultBranch || 'main'

    logger.info('Starting story analysis', {
      story: payload.story,
      slug: payload.slug,
      repoId: repoRecord.repoId,
      repoName: repoRecord.repoName,
      branchName,
    })

    // Get GitHub client for repository access
    const { repo, token: githubToken } = await getOctokitClient(repoRecord.repoId)

    const daytona = new Daytona({
      apiKey: env.DAYTONA_API_KEY,
    })

    const repoUrl = `https://github.com/${repo.ownerLogin}/${repo.repoName}.git`
    const repoPath = `workspace/${repo.repoName}`

    let sandbox: DaytonaSandbox | null = null

    try {
      // Create ephemeral sandbox
      sandbox = await daytona.create({
        ephemeral: true,
        autoArchiveInterval: 1, // 1 minute of no activity will kill the box
        labels: {
          'kyoto.repoId': repoRecord.repoId,
          'kyoto.slug': `${repo.ownerLogin}/${repo.repoName}`,
          'kyoto.task': 'evaluate-user-story',
        },
      })

      logger.info('🏎️ Daytona sandbox created', {
        sandboxId: sandbox.id,
        repoId: repoRecord.repoId,
        slug: payload.slug,
      })

      // Clone repository into sandbox
      await sandbox.git.clone(
        repoUrl,
        repoPath,
        branchName,
        undefined,
        'x-access-token',
        githubToken,
      )

      // Clean up any credentials
      await sandbox.process.executeCommand(
        'rm -f ~/.git-credentials ~/.config/gh/hosts.yml || true',
      )

      // Run the story analysis agent
      const analysisResult = await runStoryAnalysisAgent({
        story: payload.story,
        repoId: repoRecord.repoId,
        repoName: repoRecord.repoName,
        daytonaSandboxId: sandbox.id,
        maxSteps: 20,
      })

      logger.info('Story analysis completed', {
        slug: payload.slug,
        stepCount: analysisResult.stepCount,
        toolCallCount: analysisResult.toolCallCount,
        stepsCount: analysisResult.steps.length,
      })

      // Return the structured output (no side effects)
      return {
        steps: analysisResult.steps,
      }
    } catch (error) {
      logger.error('Story analysis failed', {
        story: payload.story,
        slug: payload.slug,
        error,
      })
      throw error
    } finally {
      // Clean up sandbox
      if (sandbox) {
        const sandboxId = sandbox.id
        try {
          await sandbox.delete()
          logger.info('🏎️ Stopped Daytona sandbox', {
            sandboxId,
            slug: payload.slug,
          })
        } catch (error) {
          logger.error('🏎️ Failed to stop Daytona sandbox', {
            sandboxId,
            slug: payload.slug,
            error,
          })
        }
      }
    }
  },
})
