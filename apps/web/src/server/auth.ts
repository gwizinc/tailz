import { SITE_BASE_URL } from 'astro:env/client'
import {
  AUTH_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from 'astro:env/server'

import { createAuth } from './create-auth'
import { db } from './db'

export const auth = createAuth({
  db: db,
  baseURL: SITE_BASE_URL,
  secret: AUTH_SECRET,
  github: {
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  },
})
