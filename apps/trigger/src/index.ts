import '@trigger.dev/sdk'

// Export tasks from local task definitions
export { updateGithubStatusTask } from './tasks/update-github-status'
export { handleGithubWebhookTask } from './tasks/github'
export { testStoryTask } from './tasks/test-story'
export { runCiTask } from './tasks/ci/main'
export { syncGithubInstallationTask } from './tasks/sync-github-installation'
