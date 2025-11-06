import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // Your project ref (you can see it on the Project settings page in the dashboard)
  project: process.env.TRIGGER_PROJECT_ID || 'proj_krmnzhlblfvcussrwlyu',
  // The paths for your trigger folders
  dirs: ['./src/tasks'],
  // Default retry settings
  retries: {
    // If you want to retry a task in dev mode (when using the CLI)
    enabledInDev: false,
    // The default retry settings. Used if you don't specify on a task.
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  // Max duration for all tasks (in seconds)
  maxDuration: 60 * 5, // 5 minute
})
