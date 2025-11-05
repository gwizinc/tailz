import type { Env } from '@app/api'
import { SITE_BASE_URL } from 'astro:env/client'

export const env: Env = {
  siteBaseUrl: SITE_BASE_URL,
}
