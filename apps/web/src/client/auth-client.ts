import { SITE_BASE_URL } from 'astro:env/client'
import { createAuthClient } from 'better-auth/react'

const BASE_URL =
  typeof window !== 'undefined' ? window.location.origin : SITE_BASE_URL

export const authClient = createAuthClient({
  baseURL: BASE_URL,
})

export const { signIn, signOut, signUp, useSession } = authClient

export function useUser() {
  const session = useSession()
  return session.data?.user
}
