import { beforeAll } from 'vitest'

// Set up test environment variables
beforeAll(() => {
  // Set environment variables needed for tests
  process.env.MAILGUN_WEBHOOK_SIGNING_KEY = 'test-signing-key-12345'
  process.env.NODE_ENV = 'test'

  // Database URL for test database (if different from development)
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://localhost:5432/process-pilot-test'
  }
})
