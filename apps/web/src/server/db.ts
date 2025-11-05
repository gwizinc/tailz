import { setupDb } from '@app/db'
import { DATABASE_URL } from 'astro:env/server'

export const db = setupDb(DATABASE_URL)
