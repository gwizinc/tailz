import type { DB } from '@app/db/types'
import {
  SITE_BASE_URL,
  SITE_DEPLOYMENT_URL,
  SITE_PREVIEW_BRANCH_URL,
  SITE_PRODUCTION_URL,
} from 'astro:env/client'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import type { Kysely } from 'kysely'
import { z } from 'zod'

const githubProfileSchema = z.object({
  email: z.string().trim().optional().nullable(),
  login: z.string().trim().optional().nullable(),
  id: z.union([z.string(), z.number()]).optional().nullable(),
})

/*
Passing null back from mapProfileToUser works mechanically, but Better Auth treats an empty email as a fatal condition when constructing the user record.
With GitHub accounts that hide their address you’d still hit the “email missing” error.
The fallback gives us a deterministic value so Better Auth can create the account and mark it unverified;
we can then prompt the user to supply a real email later.
*/
function getGithubEmail(profileInput: unknown): {
  email?: string
  emailVerified?: boolean
} {
  const profile = githubProfileSchema.parse(profileInput)
  return {
    email:
      profile.email ?? `github-user-${profile.id}@users.noreply.github.com`,
    emailVerified: !!profile.email,
  }
}

export function createAuth(options: {
  db: Kysely<DB>
  baseURL: string
  secret: string
  github: {
    clientId: string
    clientSecret: string
  }
}) {
  const betterAuthOptions: BetterAuthOptions = {
    appName: 'Kyoto',
    baseURL: options.baseURL,
    secret: options.secret,
    database: {
      db: options.db,
      type: 'postgres',
    },

    trustedOrigins: [
      SITE_BASE_URL,
      SITE_DEPLOYMENT_URL,
      SITE_PREVIEW_BRANCH_URL,
      SITE_PRODUCTION_URL,
      'https://www.usekyoto.com',
    ].filter((x) => x != null),

    socialProviders: {
      github: {
        clientId: options.github.clientId,
        clientSecret: options.github.clientSecret,
        mapProfileToUser: (profile) => getGithubEmail(profile),
      },
    },

    advanced: {
      database: {
        // We use Postgres for the ID generation.
        generateId: false,
      },
    },

    // Use plural table names.
    user: {
      modelName: 'users',
    },
    session: {
      modelName: 'sessions',
    },
    account: {
      modelName: 'accounts',
    },
    verification: {
      modelName: 'verifications',
    },
  }

  const auth = betterAuth<BetterAuthOptions>(betterAuthOptions)
  return auth
}
