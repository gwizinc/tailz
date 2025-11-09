import { router, protectedProcedure } from '../trpc'

export interface DailyMetricPoint {
  date: string
  count: number
}

const DAILY_WINDOW_DAYS = 30

function toUtcStartOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseCount(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function buildDailySeries(
  items: ReadonlyArray<{ createdAt: Date | null }>,
  startDate: Date,
  totalDays: number,
): DailyMetricPoint[] {
  const counts = new Map<string, number>()
  const startKey = formatDateKey(startDate)

  for (const item of items) {
    if (!item.createdAt) {
      continue
    }
    const key = formatDateKey(item.createdAt)
    if (key < startKey) {
      continue
    }
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const series: DailyMetricPoint[] = []
  for (let index = 0; index < totalDays; index += 1) {
    const current = new Date(startDate.getTime())
    current.setUTCDate(current.getUTCDate() + index)
    const key = formatDateKey(current)
    series.push({
      date: key,
      count: counts.get(key) ?? 0,
    })
  }

  return series
}

export const dashboardRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const todayUtc = toUtcStartOfDay(new Date())
    const startDate = new Date(todayUtc.getTime())
    startDate.setUTCDate(startDate.getUTCDate() - (DAILY_WINDOW_DAYS - 1))

    const [
      projectsTotalRow,
      recentProjects,
      usersTotalRow,
      recentUsers,
      runsTotalRow,
      recentRuns,
    ] = await Promise.all([
      ctx.db
        .selectFrom('repos')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('enabled', '=', true)
        .executeTakeFirst(),
      ctx.db
        .selectFrom('repos')
        .select(['createdAt'])
        .where('enabled', '=', true)
        .where('createdAt', '>=', startDate)
        .execute(),
      ctx.db
        .selectFrom('users')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      ctx.db
        .selectFrom('users')
        .select(['createdAt'])
        .where('createdAt', '>=', startDate)
        .execute(),
      ctx.db
        .selectFrom('runs')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      ctx.db
        .selectFrom('runs')
        .select(['createdAt'])
        .where('createdAt', '>=', startDate)
        .execute(),
    ])

    const projectsTotal = parseCount(projectsTotalRow?.count)
    const usersTotal = parseCount(usersTotalRow?.count)
    const runsTotal = parseCount(runsTotalRow?.count)

    const projectsSeries = buildDailySeries(
      recentProjects,
      startDate,
      DAILY_WINDOW_DAYS,
    )
    const usersSeries = buildDailySeries(
      recentUsers,
      startDate,
      DAILY_WINDOW_DAYS,
    )
    const runsSeries = buildDailySeries(
      recentRuns,
      startDate,
      DAILY_WINDOW_DAYS,
    )

    return {
      projects: {
        total: projectsTotal,
        daily: projectsSeries,
      },
      users: {
        total: usersTotal,
        daily: usersSeries,
      },
      runs: {
        total: runsTotal,
        daily: runsSeries,
      },
    }
  }),
})
