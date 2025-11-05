import type { DB, User } from '@app/db/types'
// Define a placeholder Session type based on better-auth structure
// You might need to refine this based on the actual structure
import type { Kysely, Selectable } from 'kysely'

// Placeholder: Define structure based on docs (user object within session)
export interface SessionUser {
  id: string
  // Add other relevant user properties from better-auth if known
}

export interface Session {
  user: SessionUser | null
  // Add other relevant session properties if known
}

// Env, used by TRPC to pass env variables along
export interface Env {
  siteBaseUrl: string
}

export interface Context {
  db: Kysely<DB>
  env: Env
  session: Session | null // Add session to the context
  user: Selectable<User> | null
}
