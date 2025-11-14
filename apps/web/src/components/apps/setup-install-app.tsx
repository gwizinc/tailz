'use client'

import { useEffect, useState } from 'react'
import { navigate } from 'astro:transitions/client'
import { AppLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { z } from 'zod'

interface SetupInstallAppProps {
  installationId: number
}

const syncResponseSchema = z.object({
  success: z.boolean(),
  installationId: z.number().optional(),
  ownerLogin: z.string().optional(),
  memberCount: z.number().optional(),
  error: z.string().optional(),
})

export function SetupInstallApp({ installationId }: SetupInstallAppProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function syncInstallation() {
      try {
        const response = await fetch('/api/github/app/sync-installation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            installation_id: installationId,
          }),
        })

        const data = syncResponseSchema.parse(await response.json())

        if (!data.success) {
          setError(data.error ?? 'Failed to sync installation')
          return
        }

        // Redirect to /app once sync is complete
        void navigate('/app')
      } catch (err) {
        console.error('Failed to sync installation:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to sync installation',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void syncInstallation()
  }, [installationId])

  return (
    <AppLayout>
      <div className="h-full w-full px-4 py-10 md:py-16 flex items-center justify-center">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">
              Setting up your GitHub App
            </CardTitle>
            <CardDescription>
              {isLoading
                ? 'Syncing your installation and memberships...'
                : error
                  ? 'An error occurred while setting up your installation.'
                  : 'Setup complete! Redirecting...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="mt-4 flex items-center justify-center">
                {/* TODO: Add loading image here */}
                <div className="h-32 w-32 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : error ? (
              <div className="mt-4 text-destructive">
                <p>{error}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please try refreshing the page or contact support if the issue
                  persists.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
