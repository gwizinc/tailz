import { configure, tasks } from '@trigger.dev/sdk'

import { parseEnv } from '../helpers/env'
import { protectedProcedure, router } from '../trpc'

export const testRouter = router({
  helloWorld: protectedProcedure.mutation(async ({ ctx }) => {
    const env = parseEnv(ctx.env)
    configure({
      secretKey: env.TRIGGER_SECRET_KEY,
    })

    await tasks.trigger('test-hello-world', {})

    return {
      success: true,
    }
  }),
})
