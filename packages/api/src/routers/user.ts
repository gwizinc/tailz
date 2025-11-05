import { z } from 'zod'

import { getUser } from '../actions/users/getters'
import { updateUser } from '../actions/users/setters'
import { protectedProcedure, router } from '../trpc'

// Validate timezone against IANA timezone database
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      // This will throw if the timezone is invalid
      Intl.DateTimeFormat(undefined, { timeZone: tz })
      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid timezone identifier' },
)

export const userRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    const user = await getUser({
      db: ctx.db,
      userId,
    })

    return user
  }),

  update: protectedProcedure
    .input(
      z.object({
        timeZone: timezoneSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      const user = await updateUser({
        db: ctx.db,
        userId,
        values: {
          timeZone: input.timeZone,
        },
      })

      return user
    }),
})
