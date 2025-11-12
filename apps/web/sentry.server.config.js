import * as Sentry from '@sentry/astro'

Sentry.init({
  dsn: 'https://c07d2d0652378c41d56da5fb1d7dcac6@o4510337860042752.ingest.us.sentry.io/4510337861550080',
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  integrations: [
    Sentry.openAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
})
