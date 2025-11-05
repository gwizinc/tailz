import { TRPCError } from '@trpc/server'
import type { QueryNode } from 'kysely'

export function trpcNotFoundError(_node?: QueryNode): TRPCError {
  // The '_node' parameter (QueryNode) is provided by Kysely and can be used
  // to construct a more specific error message if needed, though often a generic
  // message is sufficient for a 'NOT_FOUND' error.
  return new TRPCError({
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.', // Generic message
  })
}
