import { TRPCError } from '@trpc/server'
import type { DB, Owner, Repo, Story } from '@app/db/types'
import type { Kysely, Selectable } from 'kysely'

interface WithUserId {
  userId: string
}

export async function findOwnerForUser(
  db: Kysely<DB>,
  params: WithUserId & { orgSlug: string },
): Promise<Selectable<Owner> | null> {
  const owner = await db
    .selectFrom('owners')
    .innerJoin('ownerMemberships', 'ownerMemberships.ownerId', 'owners.id')
    .selectAll('owners')
    .where('owners.login', '=', params.orgSlug)
    .where('ownerMemberships.userId', '=', params.userId)
    .executeTakeFirst()

  return owner ?? null
}

export async function findRepoForUser(
  db: Kysely<DB>,
  params: WithUserId & { orgSlug: string; repoName: string },
): Promise<Selectable<Repo> | null> {
  const repo = await db
    .selectFrom('repos')
    .innerJoin('owners', 'owners.id', 'repos.ownerId')
    .innerJoin('repoMemberships', 'repoMemberships.repoId', 'repos.id')
    .innerJoin('ownerMemberships', (join) =>
      join
        .onRef('ownerMemberships.ownerId', '=', 'repos.ownerId')
        .onRef('ownerMemberships.userId', '=', 'repoMemberships.userId'),
    )
    .selectAll('repos')
    .where('owners.login', '=', params.orgSlug)
    .where('repos.name', '=', params.repoName)
    .where('repoMemberships.userId', '=', params.userId)
    .executeTakeFirst()

  return repo ?? null
}

export async function requireRepoForUser(
  db: Kysely<DB>,
  params: WithUserId & { orgSlug: string; repoName: string },
): Promise<Selectable<Repo>> {
  const repo = await findRepoForUser(db, params)

  if (!repo) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Repository not accessible',
    })
  }

  return repo
}

export async function findStoryForUser(
  db: Kysely<DB>,
  params: WithUserId & { storyId: string },
): Promise<{ story: Selectable<Story>; repo: Selectable<Repo> } | null> {
  const story = await db
    .selectFrom('stories')
    .selectAll()
    .where('stories.id', '=', params.storyId)
    .executeTakeFirst()

  if (!story) {
    return null
  }

  const repo = await db
    .selectFrom('repos')
    .innerJoin('repoMemberships', 'repoMemberships.repoId', 'repos.id')
    .innerJoin('ownerMemberships', (join) =>
      join
        .onRef('ownerMemberships.ownerId', '=', 'repos.ownerId')
        .onRef('ownerMemberships.userId', '=', 'repoMemberships.userId'),
    )
    .selectAll('repos')
    .where('repos.id', '=', story.repoId)
    .where('repoMemberships.userId', '=', params.userId)
    .executeTakeFirst()

  if (!repo) {
    return null
  }

  return { story, repo }
}
