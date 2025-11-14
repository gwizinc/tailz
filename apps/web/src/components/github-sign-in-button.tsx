'use client'

import { useState } from 'react'
import { Github, Loader2 } from 'lucide-react'

import { signIn } from '@/client/auth-client'
import { Button } from '@/components/ui/button'

interface GitHubSignInButtonProps {
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
}

export function GitHubSignInButton({
  size = 'default',
  className,
  children,
}: GitHubSignInButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleGitHubSignIn = async () => {
    setLoading(true)
    await signIn.social({
      provider: 'github',
      callbackURL: '/install',
    })
  }

  return (
    <Button
      size={size}
      disabled={loading}
      onClick={handleGitHubSignIn}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Signing in...</span>
        </>
      ) : (
        <>
          <Github className="h-4 w-4" aria-hidden="true" />
          {children || 'Sign in with GitHub'}
        </>
      )}
    </Button>
  )
}

