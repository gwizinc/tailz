'use client'

import { navigate } from 'astro:transitions/client'
import React, { useEffect } from 'react'

import { useSession } from '@/client/auth-client'

import { LoadingProgress } from '../ui/loading-progress'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const session = useSession()

  useEffect(() => {
    // Redirect if session exists but has no data (user not logged in)
    // and the pending state is resolved.
    if (!session.isPending && !session.data && !session.error) {
      void navigate(`/auth?redirect=${window.location.pathname}`)
    }
  }, [session.isPending, session.data, session.error])

  if (session.isPending) {
    // You might want a more sophisticated loading skeleton here
    return <LoadingProgress label="Loading session..." />
  }

  if (session.error) {
    // Handle error state, maybe show a generic error message
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Error loading session: {session.error.message}
      </div>
    )
  }

  // If session.data is null and not pending/error, the useEffect will redirect.
  // We can render null or a minimal loader here briefly before redirect.
  if (!session.data) {
    return null // Or a minimal loading indicator if preferred
  }

  // User is authenticated, render the children
  return <>{children}</>
}
