import { z } from 'zod'

const envSchema = z.object({
  GITHUB_APP_ID: z.string().transform((val) => {
    const parsed = Number.parseInt(val, 10)
    if (Number.isNaN(parsed)) {
      throw new TypeError(`Invalid GITHUB_APP_ID: ${val} is not a number`)
    }
    return parsed
  }),
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1, 'GITHUB_APP_PRIVATE_KEY is required'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TRIGGER_PROJECT_ID: z.string().optional(),
})

export type ParsedEnv = z.infer<typeof envSchema>

export function parseEnv(): ParsedEnv {
  return envSchema.parse({
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TRIGGER_PROJECT_ID: process.env.TRIGGER_PROJECT_ID,
  })
}
