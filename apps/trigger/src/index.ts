import '@trigger.dev/sdk'

// Export tasks from local task definitions
export { handleGithubWebhookTask, supportedEventTypes } from './tasks/github'
export { testStoryTask } from './tasks/test-story'
export { storyDecompositionTask } from './tasks/story-decomposition'
export { decomposeAllStoriesTask } from './tasks/decompose-all-stories'
export { runCiTask } from './tasks/ci/main'
export { syncGithubInstallationTask } from './tasks/sync-github-installation'
export { syncAllGithubInstallationsTask } from './tasks/sync-all-github-installations'
