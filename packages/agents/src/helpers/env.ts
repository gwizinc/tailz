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
    .min(1, 'GITHUB_APP_PRIVATE_KEY is required')
    .describe(
      'Provide the GitHub App private key in PKCS#8 PEM format. Download it from GitHub or convert an RSA key with: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key-rsa.pem -out key-pkcs8.pem. Set this variable to the PEM text or its base64 encoding.',
    )
    .transform((val, ctx) => {
      const header = '-----BEGIN PRIVATE KEY-----'
      const trimmed = val.trim()

      if (trimmed.includes(header)) {
        return trimmed
      }

      const normalized = trimmed.replace(/\s+/g, '')

      try {
        const decoded = Buffer.from(normalized, 'base64')
          .toString('utf-8')
          .trim()

        if (decoded.startsWith(header)) {
          return decoded
        }
      } catch {
        // fall through to issue below
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'GITHUB_APP_PRIVATE_KEY must be a PEM string or a base64-encoded PEM string',
      })
      return z.NEVER
    }),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TRIGGER_PROJECT_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  DAYTONA_API_KEY: z.string().min(1, 'DAYTONA_API_KEY is required'),
  SITE_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.replace(/\/+$/, ''))
    .optional(),
})

type ParsedEnv = z.infer<typeof envSchema>

export function parseEnv(): ParsedEnv {
  return envSchema.parse({
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TRIGGER_PROJECT_ID: process.env.TRIGGER_PROJECT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
    SITE_BASE_URL: process.env.SITE_BASE_URL,
  })
}
