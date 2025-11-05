export interface RunWorkflowPayload {
  runId: string
  orgSlug: string
  repoName: string
  branchName: string
  repoId: string
  commitSha: string
  commitMessage: string | null
  prNumber?: number
  installationId: number
  appId: number
  privateKey: string
  openRouterApiKey: string
  databaseUrl: string
}

export interface StoryTestResult {
  storyId: string
  status: 'pass' | 'fail' | 'skipped'
  error?: string
}
