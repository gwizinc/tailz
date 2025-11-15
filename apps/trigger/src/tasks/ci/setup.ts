import { sql } from '@app/db'
import type { RunStory } from '@app/db'
import type { GitAuthor } from '../../helpers/github'
import type {
  DbClient,
  RepoRecord,
  RunCiPayload,
  RunInsert,
  StoryRow,
} from './types'

export function getBranchName(payload: RunCiPayload): string {
  return payload.branchName?.trim() || 'main'
}

export async function getRepoRecord(
  db: DbClient,
  payload: RunCiPayload,
): Promise<RepoRecord> {
  const repoRecord = await db
    .selectFrom('repos')
    .innerJoin('owners', 'repos.ownerId', 'owners.id')
    .select([
      'repos.id as repoId',
      'repos.defaultBranch as defaultBranch',
      'repos.name as repoName',
      'owners.login as ownerLogin',
    ])
    .where('owners.login', '=', payload.orgName)
    .where('repos.name', '=', payload.repoName)
    .executeTakeFirst()

  if (!repoRecord) {
    throw new Error(
      `Repository ${payload.orgName}/${payload.repoName} not found in database`,
    )
  }

  return repoRecord
}

export async function getStories(
  db: DbClient,
  repoId: string,
): Promise<StoryRow[]> {
  const storiesQuery = db
    .selectFrom('stories')
    .select(['id', 'name', 'story'])
    .where('repoId', '=', repoId)
    .where('archived', '=', false)

  return (await storiesQuery.execute()) as StoryRow[]
}

export function buildInitialRunStories(stories: StoryRow[]): RunStory[] {
  return stories.map((story) => ({
    storyId: story.id,
    status: 'running',
    resultId: null,
    startedAt: new Date().toISOString(),
    summary: null,
    completedAt: null,
  }))
}

export function getInitialRunMeta(stories: StoryRow[]): {
  runStatus: 'skipped' | 'running'
  runSummary: string | null
} {
  if (stories.length === 0) {
    return {
      runStatus: 'skipped',
      runSummary: 'No stories available for evaluation',
    }
  }

  return {
    runStatus: 'running',
    runSummary: null,
  }
}

interface CreateRunRecordParams {
  db: DbClient
  repoId: string
  branchName: string
  runStatus: 'skipped' | 'running'
  initialRunStories: RunStory[]
  commitSha: string | null
  commitMessage: string | null
  runSummary: string | null
  prNumber?: string | null
  gitAuthor?: GitAuthor | null
}

export async function createRunRecord({
  db,
  repoId,
  branchName,
  runStatus,
  initialRunStories,
  commitSha,
  commitMessage,
  runSummary,
  prNumber = null,
  gitAuthor = null,
}: CreateRunRecordParams): Promise<RunInsert> {
  const gitAuthorJson =
    gitAuthor && (gitAuthor.id || gitAuthor.login || gitAuthor.name)
      ? {
          id: gitAuthor.id ?? null,
          login: gitAuthor.login ?? null,
          name: gitAuthor.name ?? null,
        }
      : null

  const insertedRun = await sql<RunInsert>`
      INSERT INTO public.runs (
        repo_id,
        branch_name,
        status,
        stories,
        commit_sha,
        commit_message,
        pr_number,
        summary,
        git_author
      ) VALUES (
        ${repoId},
        ${branchName},
        ${runStatus},
        ${JSON.stringify(initialRunStories)}::jsonb,
        ${commitSha},
        ${commitMessage},
        ${prNumber},
        ${runSummary},
        ${gitAuthorJson ? sql`${JSON.stringify(gitAuthorJson)}::jsonb` : sql`NULL`}
      )
      RETURNING id, number
    `.execute(db)

  const runInsert = insertedRun.rows[0]

  if (!runInsert) {
    throw new Error('Failed to create run record')
  }

  return runInsert
}

export function buildRunDetailsUrl(
  baseUrl: string | undefined,
  repoRecord: RepoRecord,
  runNumber: number,
): string | null {
  if (!baseUrl) {
    return null
  }

  return `${baseUrl}/org/${repoRecord.ownerLogin}/${repoRecord.repoName}/runs/${runNumber}`
}
