import type { setupDb } from '@app/db'

export interface RunCiPayload {
  orgName: string
  repoName: string
  branchName?: string | null
  prNumber?: string | null
  agentVersion?: string
}

/*
TODO change to this soon.
TODO add allow for commit sha testing 
export interface RunCiPayload {
  repo: {
    id: string
    slug: string
  }
  git: {
    branch?: string
    sha?: string
  }
}
*/

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
