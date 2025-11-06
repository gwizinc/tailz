import type { Env } from '../context'
import { z } from 'zod'

const envSchema = z.object({
  GITHUB_APP_ID: z.union([z.string(), z.number()]).transform((val) => {
    const parsed = typeof val === 'string' ? Number.parseInt(val, 10) : val
    if (Number.isNaN(parsed)) {
      throw new TypeError(`Invalid GITHUB_APP_ID: ${val} is not a number`)
    }
    return parsed
  }),
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1, 'GITHUB_APP_PRIVATE_KEY is required')
    .startsWith('-----BEGIN RSA PRIVATE KEY-----'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .startsWith('postgres://'),
  TRIGGER_SECRET_KEY: z
    .string()
    .min(1, 'TRIGGER_SECRET_KEY is required')
    .startsWith('tr_'),
})

export type ParsedEnv = z.infer<typeof envSchema>

export function parseEnv(env: Env): ParsedEnv {
  return envSchema.parse({
    GITHUB_APP_ID: env.githubAppId,
    GITHUB_APP_PRIVATE_KEY: env.githubAppPrivateKey,
    OPENROUTER_API_KEY: env.openRouterApiKey,
    DATABASE_URL: env.databaseUrl,
    TRIGGER_SECRET_KEY: env.triggerSecretKey,
  })
}
