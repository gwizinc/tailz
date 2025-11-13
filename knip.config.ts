import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['**/*.config.{js,ts}', 'turbo.json'],
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
      entry: ['src/pages/**/*.{astro,ts}', 'src/layouts/**/*.astro'],
      ignore: ['**/node_modules/**', '**/.astro/**', '**/dist/**', '**/*.d.ts'],
    },
    'apps/trigger': {
      entry: ['trigger.config.ts'],
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
      ignoreDependencies: ['@babel/preset-typescript'],
    },
    'packages/api': {
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
    'packages/db': {
      entry: ['src/db.ts'],
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
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
    'packages/agents': {
      project: ['src/**/*.ts'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
  },
  ignore: [
    'apps/web/src/components/**',
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
  ignoreDependencies: ['vitest', '@types/*', '@vitejs/plugin-react'],
  ignoreBinaries: ['pg_dump', 'psql', 'sed'],
}

export default config
