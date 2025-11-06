import type { Env } from '@app/api'
import { SITE_BASE_URL } from 'astro:env/client'
import {
  DATABASE_URL,
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET,
  OPENROUTER_API_KEY,
  TRIGGER_SECRET_KEY,
} from 'astro:env/server'

export const env: Env = {
  siteBaseUrl: SITE_BASE_URL,
  githubAppId: GITHUB_APP_ID,
  githubAppPrivateKey: GITHUB_APP_PRIVATE_KEY,
  githubWebhookSecret: GITHUB_WEBHOOK_SECRET,
  openRouterApiKey: OPENROUTER_API_KEY,
  databaseUrl: DATABASE_URL,
  triggerSecretKey: TRIGGER_SECRET_KEY,
}
