'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { signIn, useSession } from '@/client/auth-client'
import { Button } from '@/components/ui/button'

export function SignIn() {
  const [loading, setLoading] = useState(false)
  const session = useSession()

  // Redirect to /app if user is already logged in
  useEffect(() => {
    if (session.data?.user && !session.isPending) {
      window.location.href = '/app'
    }
  }, [session.data, session.isPending])

  const handleGitHubSignIn = async () => {
    setLoading(true)
    await signIn.social({
      provider: 'github',
      callbackURL: '/setup',
    })
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <p
        className="text-sm font-semibold tracking-[0.3em] text-primary mb-4"
        title="Roguin - to login."
      >
        ログイン
      </p>
      <h2 className="text-2xl font-display text-foreground mb-3">
        Welcome to Kyoto
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        Vibe crafted to help you ship working code.
      </p>
      <div className="flex flex-col items-center gap-4 mb-8">
        <Button
          size="lg"
          disabled={loading}
          onClick={handleGitHubSignIn}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              className="h-4 w-4"
            >
              <path
                fill="currentColor"
                d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"
              />
            </svg>
          )}
          {loading ? 'Signing in...' : 'Sign in with GitHub'}
        </Button>
      </div>
      <div className="text-balance text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{' '}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </div>
    </div>
  )
}
