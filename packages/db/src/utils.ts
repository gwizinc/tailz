import { type RawBuilder, sql } from 'kysely'

export function json<T>(value: T): RawBuilder<T> {
  return sql`CAST(${JSON.stringify(value)} AS JSONB)`
}
