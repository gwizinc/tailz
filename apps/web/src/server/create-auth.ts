import type { DB } from '@app/db/types'
import {
  SITE_BASE_URL,
  SITE_DEPLOYMENT_URL,
  SITE_PREVIEW_BRANCH_URL,
  SITE_PRODUCTION_URL,
} from 'astro:env/client'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import type { Kysely } from 'kysely'

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
    appName: 'Monorepo',
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
    ].filter((x) => x != null),

    socialProviders: {
      github: {
        clientId: options.github.clientId,
        clientSecret: options.github.clientSecret,
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
