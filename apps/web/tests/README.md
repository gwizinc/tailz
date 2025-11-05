# Astro API Endpoint Testing

This directory contains tests for Astro API endpoints using Vitest and a real Astro dev server.

## Overview

Instead of mocking API functions, we start a real Astro dev server and make HTTP requests against it. This provides more realistic testing that better matches production behavior.

## Test Structure

### Helper Files

- **`helpers/server.helpers.ts`** - Manages the Astro dev server lifecycle
- **`helpers/database.helpers.ts`** - Provides utilities for creating and cleaning up test data
- **`helpers/mailgun.helpers.ts`** - Utilities for creating Mailgun webhook payloads

### Writing Tests

1. **Server Management**: Use `beforeAll` and `afterAll` hooks to start/stop the server:

```typescript
import { startTestServer, stopTestServer } from '../helpers/server.helpers'

beforeAll(async () => {
  await startTestServer()
})

afterAll(async () => {
  await stopTestServer()
})
```

2. **Test Data**: Create test data in the database before making requests:

```typescript
import {
  setupTestEnvironment,
  cleanupTestData,
} from '../helpers/database.helpers'

it('should process a webhook', async () => {
  // Create test tenant, user, and project
  const { project } = await setupTestEnvironment({
    projectInboundEmailToken: 'test-token',
  })

  // Make request using the created data
  const response = await fetchTestEndpoint('/api/webhooks/mailgun/inbound', {
    method: 'POST',
    body: createPayloadForProject(project),
  })
})

// Clean up after all tests
afterAll(async () => {
  await cleanupTestData()
})
```

3. **Making Requests**: Use `fetchTestEndpoint` to make requests:

```typescript
import { fetchTestEndpoint } from '../helpers/server.helpers'

const response = await fetchTestEndpoint('/api/my-endpoint', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({ data: 'test' }),
})
```

## Environment Variables

Test environment variables are configured in `tests/setup.ts`. The following are set by default:

- `MAILGUN_WEBHOOK_SIGNING_KEY` - Used for Mailgun webhook signature validation
- `DATABASE_URL` - Points to the test database

## Best Practices

1. **Isolation**: Each test should create its own test data to avoid conflicts
2. **Cleanup**: Always clean up test data in `afterAll` hooks
3. **Realistic Data**: Use the database helpers to create realistic test scenarios
4. **Port Management**: The test server runs on port 4321 by default

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test apps/web/tests/api/webhooks/mailgun/inbound.test.ts
```

## Debugging

- Increase timeouts if tests are timing out (configured in `vitest.config.ts`)
- Check that the database is accessible and migrations are up to date
- Ensure no other services are running on port 4321
