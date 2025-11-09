import '@trigger.dev/sdk'

// Export tasks from local task definitions
export { updateGithubStatusTask } from './tasks/update-github-status'
export { helloWorldTask } from './tasks/hello-world'
export { handleGithubWebhookTask } from './tasks/handle-github-webhook'
export { testStoryTask } from './tasks/test-story'
export { runCiTask } from './tasks/ci/main'
export { syncGithubInstallationTask } from './tasks/sync-github-installation'
