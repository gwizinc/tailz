'use client'

import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type BackendStatus = 'idle' | 'pending' | 'triggered' | 'failed'

export function DevTools() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('idle')
  const [backendMessage, setBackendMessage] = useState<string | null>(null)

  const triggerFrontendError = useCallback(() => {
    setTimeout(() => {
      throw new Error('Sentry frontend dev test error')
    }, 0)
  }, [])

  const triggerBackendError = useCallback(async () => {
    setBackendStatus('pending')
    setBackendMessage(null)

    try {
      const response = await fetch('/api/dev/sentry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kind: 'backend' }),
      })

      if (!response.ok) {
        setBackendStatus('triggered')
        setBackendMessage(
          `Backend error triggered (status ${response.status}). This is expected for the Sentry test.`,
        )
        return
      }

      setBackendStatus('triggered')
      setBackendMessage('Backend call succeeded without error.')
    } catch (error) {
      console.error('Failed to trigger backend Sentry test', error)
      setBackendStatus('failed')
      setBackendMessage(
        'Failed to trigger backend test. Check the console for details.',
      )
    }
  }, [])

  return (
    <div className="p-6 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sentry Frontend Test</CardTitle>
          <CardDescription>
            Throws an uncaught error on the client. Refresh the page after
            triggering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={triggerFrontendError}>
            Throw frontend error
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentry Backend Test</CardTitle>
          <CardDescription>
            Calls an API route that throws. The request should return a 500
            response.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            onClick={triggerBackendError}
            variant="outline"
            disabled={backendStatus === 'pending'}
          >
            {backendStatus === 'pending'
              ? 'Triggering…'
              : 'Throw backend error'}
          </Button>
          {backendMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {backendMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
