import type { AppRouter } from '@app/api'
import { createTRPCContext } from '@trpc/tanstack-react-query'

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>()
