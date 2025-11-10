import { defineConfig } from '@trigger.dev/sdk'
import { esbuildPlugin } from '@trigger.dev/build/extensions'
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin'
import * as Sentry from '@sentry/node'

export default defineConfig({
  // Your project ref (you can see it on the Project settings page in the dashboard)
  project: process.env.TRIGGER_PROJECT_ID || 'proj_krmnzhlblfvcussrwlyu',
  // The paths for your trigger folders
  dirs: ['./src/tasks'],
  build: {
    extensions: [
      esbuildPlugin(
        sentryEsbuildPlugin({
          org: '<your-sentry-org>',
          project: '<your-sentry-project>',
          // Find this auth token in settings -> developer settings -> auth tokens
          authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
        { placement: 'last', target: 'deploy' },
      ),
    ],
  },
  init: async () => {
    Sentry.init({
      defaultIntegrations: false,
      // The Data Source Name (DSN) is a unique identifier for your Sentry project.
      dsn: process.env.SENTRY_DSN,
      // Update this to match the environment you want to track errors for
      environment:
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
    })
  },
  onFailure: async ({ payload, error, ctx }) => {
    Sentry.captureException(error, {
      extra: {
        payload,
        ctx,
      },
    })
  },
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
  maxDuration: 60 * 15, // 15 minute
})
