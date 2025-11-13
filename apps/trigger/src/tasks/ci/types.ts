import type { setupDb } from '@app/db'
import type { AgentVersion } from '@app/agents'

export interface RunCiPayload {
  orgSlug: string
  repoName: string
  branchName?: string | null
  prNumber?: string | null
  agentVersion?: AgentVersion
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
