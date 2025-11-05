import type { AppRouter } from '@app/api'
import { isError } from '@app/utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'

import { TRPCProvider } from '@/client/trpc'
import { useSmartPolling } from '@/hooks/use-smart-polling'

import { SmartPollingProvider } from './smart-polling-provider'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000, // 30 seconds - reduced for more responsive updates
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }
    return browserQueryClient
  }
}

function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') {
      return ''
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`
    }
    return 'http://localhost:3001'
  })()
  return `${base}/api/trpc`
}

/**
 * Inner tRPC provider that has access to smart polling context
 */
function TrpcProviderInner({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const { refetchInterval } = useSmartPolling()

  // Update default query options with smart polling interval
  queryClient.setDefaultOptions({
    queries: {
      ...queryClient.getDefaultOptions().queries,
      refetchInterval,
    },
  })

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (options): boolean => {
            // Log all traffic in dev mode
            if (import.meta.env.DEV) {
              return true
            }

            // Log errors
            if (options.direction === 'down' && isError(options.result)) {
              return true
            }

            return false
          },
        }),
        httpBatchStreamLink({
          url: getUrl(),
          transformer: superjson,
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}

/**
 * Main tRPC provider that includes smart polling
 */
export function TrpcProvider({ children }: { children: React.ReactNode }) {
  return (
    <SmartPollingProvider>
      <TrpcProviderInner>{children}</TrpcProviderInner>
    </SmartPollingProvider>
  )
}
