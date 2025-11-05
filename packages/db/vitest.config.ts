import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // For database tests, you might need to set up a test database
    // and potentially use a setup file to manage connections/migrations.
    // setupFiles: './src/setupTests.ts',
  },
})
