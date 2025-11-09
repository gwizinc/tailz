import type { setupDb } from '@app/db'

export interface RunCiPayload {
  orgSlug: string
  repoName: string
  branchName?: string | null
}

export type StoryRow = {
  id: string
  name: string
  story: string
  branchName: string
}

export interface RepoRecord {
  repoId: string
  defaultBranch: string | null
  repoName: string
  ownerLogin: string
}

export interface RunInsert {
  id: string
  number: number
}

export type DbClient = ReturnType<typeof setupDb>

