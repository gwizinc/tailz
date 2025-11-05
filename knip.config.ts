import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['**/*.config.{js,ts}', 'turbo.json', 'vitest.config.ts'],
      project: ['**/*.{js,ts,tsx,astro}'],
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.turbo/**',
        '**/.astro/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/seed.sql',
        '**/schema.sql',
        '**/migrations/**',
      ],
    },
    'apps/web': {
      entry: [
        'src/pages/**/*.{astro,ts}',
        'src/layouts/**/*.astro',
        'src/middleware.ts',
        'astro.config.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      project: ['src/**/*.{ts,tsx,astro}'],
      ignore: [
        '**/node_modules/**',
        '**/.astro/**',
        '**/dist/**',
        '**/*.d.ts',
      ],
    },
    'apps/trigger': {
      entry: ['src/index.ts', 'trigger.config.ts'],
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
    'packages/api': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
    'packages/db': {
      entry: ['src/index.ts', 'src/db.ts'],
      project: ['src/**/*.ts'],
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/types.gen.ts',
        '**/*.d.ts',
        '**/migrations/**',
      ],
    },
    'packages/utils': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
  },
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/.astro/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/types.gen.ts',
    '**/migrations/**',
    '**/seed.sql',
    '**/schema.sql',
  ],
  ignoreDependencies: [
    // Astro auto-generated files
    '@astrojs/node',
    '@astrojs/react',
    '@astrojs/vercel',
    // Type generation
    'kysely-codegen',
    // Build tools
    'turbo',
    'typescript',
    'vitest',
    'eslint',
    'prettier',
    // Development dependencies
    '@types/*',
    '@vitejs/plugin-react',
    'jsdom',
    'tailwindcss',
    'tailwindcss-animate',
    'tw-animate-css',
  ],
}

export default config

