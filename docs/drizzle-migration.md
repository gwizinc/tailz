# Product Requirements Document: Kysely to Drizzle ORM Migration

**Status:** Draft  
**Date:** 2025-01-27  
**Author:** Migration Analysis  
**Version:** 1.0

---

## Executive Summary

This document outlines the migration plan from Kysely to Drizzle ORM for the Tailz monorepo. The migration is **moderate complexity** with an estimated **1-2 weeks** of focused development work. The API differences are primarily syntactic rather than conceptual, making this a straightforward refactoring effort.

### Key Findings

- **Query Count:** ~68 database operations across 16 files
- **Complexity:** Mostly CRUD operations with some complex joins and CTEs
- **API Compatibility:** High - all patterns translate directly to Drizzle equivalents
- **Risk Level:** Low-Medium (syntactic changes, no architectural blockers)
- **Migration Effort:** 1-2 weeks

---

## 1. Current State Analysis

### 1.1 Technology Stack

**Current Database Layer:**
- **ORM:** Kysely v0.28.8
- **Type Generation:** kysely-codegen v0.19.0
- **Database:** PostgreSQL (Neon serverless + standard Postgres)
- **Connection Pooling:** `@neondatabase/serverless` + `pg`
- **Migrations:** node-pg-migrate (SQL-based)

### 1.2 Codebase Inventory

#### Database Package (`packages/db/`)
- **Core Setup:** `src/db.ts` - Connection pooling, Neon/Postgres detection
- **Type System:** `src/types.gen.ts` - Auto-generated from schema (523 lines)
- **Custom Types:** `src/column-types.ts` - JSONB column type definitions
- **Utilities:** `src/utils.ts` - JSONB helper functions
- **Exports:** `src/index.ts` - Public API surface

#### Query Usage Distribution

**Files with Database Queries:**
1. `packages/api/src/routers/story.ts` - 9 queries
2. `packages/api/src/routers/repo.ts` - 6 queries
3. `packages/api/src/routers/run.ts` - 4 queries
4. `packages/api/src/routers/org.ts` - 3 queries
5. `packages/api/src/helpers/memberships.ts` - 4 queries
6. `packages/api/src/helpers/users.ts` - 4 queries
7. `apps/trigger/src/tasks/github/shared/db.ts` - 21 queries
8. `apps/trigger/src/tasks/ci/setup.ts` - 2 queries
9. `apps/trigger/src/tasks/ci/sandbox.ts` - 4 queries
10. `apps/trigger/src/tasks/ci/results.ts` - 2 queries
11. `apps/trigger/src/tasks/test-story.ts` - 1 query
12. `apps/trigger/src/tasks/story-decomposition.ts` - 2 queries
13. `apps/trigger/src/tasks/sync-github-installation.ts` - 3 queries
14. `apps/web/src/pages/api/github/app/callback.ts` - 1 query
15. `apps/web/src/server/create-auth.ts` - Uses DB type
16. `packages/api/src/context.ts` - Uses DB type

**Total:** ~68 query operations across 16 files

### 1.3 Query Pattern Analysis

#### Pattern Distribution

| Pattern | Count | Complexity | Examples |
|---------|-------|------------|----------|
| Simple SELECT | ~25 | Low | `selectFrom().where().execute()` |
| SELECT with JOINs | ~15 | Medium | Multi-table joins with conditions |
| INSERT | ~8 | Low | `insertInto().values().returning()` |
| UPDATE | ~10 | Low | `updateTable().set().where()` |
| DELETE | ~3 | Low | `deleteFrom().where()` |
| Upsert (onConflict) | ~5 | Medium | `insertInto().onConflict().doUpdateSet()` |
| CTEs (WITH clauses) | ~2 | High | Complex aggregations with subqueries |
| Transactions | ~2 | Medium | `transaction().execute()` |
| Raw SQL | ~3 | Low | `sql` template literals |
| Aggregations | ~5 | Medium | `count()`, `max()`, `groupBy()` |

#### Complex Query Examples

**1. Multi-table JOIN with callback conditions:**
```typescript
// packages/api/src/helpers/memberships.ts
.innerJoin('ownerMemberships', (join) =>
  join
    .onRef('ownerMemberships.ownerId', '=', 'repos.ownerId')
    .onRef('ownerMemberships.userId', '=', 'repoMemberships.userId'),
)
```

**2. CTE with aggregation:**
```typescript
// packages/api/src/routers/repo.ts
.with('latest_run_times', (db) =>
  db
    .selectFrom('runs')
    .select((eb) => eb.fn.max('createdAt').as('maxCreatedAt'))
    .where('repoId', 'in', repoIds)
    .groupBy('repoId'),
)
```

**3. Upsert with multi-column conflict:**
```typescript
// apps/trigger/src/tasks/github/shared/db.ts
.onConflict((oc) =>
  oc.columns(['ownerId', 'userId']).doUpdateSet({
    role,
  }),
)
```

### 1.4 Type System

**Current Type Helpers:**
- `Selectable<T>` - For reading data
- `Insertable<T>` - For creating records
- `Updateable<T>` - For updating records
- `ColumnType<T>` - Custom JSONB types

**Type Generation:**
- Auto-generated from `schema.sql` via `kysely-codegen`
- 523 lines of type definitions
- Custom column types in `column-types.ts`

### 1.5 Dependencies

**Current:**
```json
{
  "kysely": "^0.28.8",
  "kysely-codegen": "^0.19.0",
  "@neondatabase/serverless": "^1.0.2",
  "pg": "^8.16.3"
}
```

**Target:**
```json
{
  "drizzle-orm": "^0.29.0",
  "drizzle-kit": "^0.20.0",
  "@neondatabase/serverless": "^1.0.2", // Keep
  "pg": "^8.16.3" // Keep
}
```

---

## 2. Target State

### 2.1 Technology Stack

**Target Database Layer:**
- **ORM:** Drizzle ORM v0.29+
- **Type Generation:** Drizzle Kit (schema-first)
- **Database:** PostgreSQL (Neon serverless + standard Postgres) - **No change**
- **Connection Pooling:** `@neondatabase/serverless` + `pg` - **No change**
- **Migrations:** Drizzle Kit migrations (TypeScript-based)

### 2.2 Architecture Changes

#### Schema Definition
- **Current:** SQL schema → kysely-codegen → TypeScript types
- **Target:** TypeScript schema → Drizzle Kit → SQL migrations + types

#### Query API
- **Current:** Kysely builder pattern (`selectFrom().where()`)
- **Target:** Drizzle SQL-like API (`select().from().where()`)

#### Type System
- **Current:** `Selectable<T>`, `Insertable<T>`, `Updateable<T>`
- **Target:** Inferred types from schema + Drizzle type helpers

### 2.3 Benefits

1. **Modern API:** More intuitive SQL-like syntax
2. **Better TypeScript Inference:** Improved type safety and autocomplete
3. **Active Development:** More frequent updates and community support
4. **Schema-First:** TypeScript schema definitions enable better DX
5. **Migration Tools:** Built-in migration generation and management

---

## 3. API Compatibility Analysis

### 3.1 Pattern Translation Matrix

| Kysely Pattern | Drizzle Equivalent | Complexity | Notes |
|----------------|---------------------|------------|-------|
| `selectFrom('table')` | `select().from(table)` | Low | Table reference vs string |
| `where('col', '=', val)` | `where(eq(col, val))` | Low | Function-based conditions |
| `innerJoin('table', callback)` | `innerJoin(table, and(...))` | Medium | Callback → `and()` + `eq()` |
| `insertInto('table')` | `insert(table)` | Low | Method name change |
| `updateTable('table')` | `update(table)` | Low | Method name change |
| `deleteFrom('table')` | `delete(table)` | Low | Method name change |
| `.onConflict(callback)` | `.onConflictDoUpdate({...})` | Low | Different API structure |
| `.with('name', callback)` | `db.$with('name').as(...)` | Medium | Syntax change |
| `sql\`...\`` | `sql\`...\`` | Minimal | Same approach |
| `transaction().execute()` | `transaction()` | Minimal | Remove wrapper |

### 3.2 Detailed Pattern Examples

#### Example 1: Simple SELECT
**Kysely:**
```typescript
await db
  .selectFrom('users')
  .selectAll()
  .where('id', '=', userId)
  .executeTakeFirst()
```

**Drizzle:**
```typescript
await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1)
```

#### Example 2: Complex JOIN
**Kysely:**
```typescript
.innerJoin('ownerMemberships', (join) =>
  join
    .onRef('ownerMemberships.ownerId', '=', 'repos.ownerId')
    .onRef('ownerMemberships.userId', '=', 'repoMemberships.userId'),
)
```

**Drizzle:**
```typescript
.innerJoin(ownerMemberships, and(
  eq(ownerMemberships.ownerId, repos.ownerId),
  eq(ownerMemberships.userId, repoMemberships.userId)
))
```

#### Example 3: CTE
**Kysely:**
```typescript
.with('latest_run_times', (db) =>
  db
    .selectFrom('runs')
    .select((eb) => eb.fn.max('createdAt').as('maxCreatedAt'))
    .groupBy('repoId'),
)
```

**Drizzle:**
```typescript
const latestRunTimes = db.$with('latest_run_times').as(
  db
    .select({
      repoId: runs.repoId,
      maxCreatedAt: sql`max(${runs.createdAt})`.as('maxCreatedAt')
    })
    .from(runs)
    .groupBy(runs.repoId)
)
```

#### Example 4: Upsert
**Kysely:**
```typescript
.onConflict((oc) =>
  oc.columns(['ownerId', 'userId']).doUpdateSet({
    role,
  }),
)
```

**Drizzle:**
```typescript
.onConflictDoUpdate({
  target: [ownerMemberships.ownerId, ownerMemberships.userId],
  set: { role }
})
```

### 3.3 Type System Migration

**Current:**
```typescript
import type { Selectable, Insertable, Updateable } from 'kysely'
import type { User } from '@app/db/types'

function getUser(): Promise<Selectable<User> | null>
function createUser(data: Insertable<User>): Promise<Selectable<User>>
function updateUser(data: Partial<Updateable<User>>): Promise<Selectable<User>>
```

**Target:**
```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { users } from '@app/db/schema'

type User = InferSelectModel<typeof users>
type NewUser = InferInsertModel<typeof users>

function getUser(): Promise<User | null>
function createUser(data: NewUser): Promise<User>
function updateUser(data: Partial<NewUser>): Promise<User>
```

---

## 4. Migration Strategy

### 4.1 Approach: Incremental Migration

**Strategy:** Create parallel implementation, migrate incrementally, remove old code

**Phases:**
1. **Setup Phase** - Install Drizzle, create schema definitions
2. **Core Migration** - Migrate database package
3. **Query Migration** - Migrate queries file-by-file
4. **Cleanup Phase** - Remove Kysely dependencies

### 4.2 Migration Phases

#### Phase 1: Foundation (Days 1-2)
**Goal:** Set up Drizzle infrastructure

**Tasks:**
1. Install Drizzle packages
   ```bash
   pnpm add drizzle-orm@latest --filter @app/db
   pnpm add -D drizzle-kit@latest --filter @app/db
   ```

2. Create Drizzle schema from existing SQL schema
   - Convert `schema.sql` → `src/schema.ts`
   - Define all tables, columns, indexes, constraints
   - Map custom types (JSONB, enums, etc.)

3. Configure Drizzle Kit
   - Create `drizzle.config.ts`
   - Set up connection string handling
   - Configure migration output directory

4. Generate initial migration
   - Use current schema as baseline
   - Verify SQL output matches existing schema

5. Update `packages/db/src/db.ts`
   - Create `setupDrizzle()` function
   - Maintain Neon/Postgres detection
   - Keep connection pooling logic

**Deliverables:**
- ✅ Drizzle schema definitions
- ✅ Drizzle database instance setup
- ✅ Migration configuration
- ✅ Type exports working

#### Phase 2: Core Package Migration (Days 3-4)
**Goal:** Migrate database package exports and utilities

**Tasks:**
1. Update `packages/db/src/index.ts`
   - Export Drizzle instance instead of Kysely
   - Export schema tables
   - Update type exports

2. Migrate `packages/db/src/utils.ts`
   - Update JSONB helper functions
   - Replace Kysely `sql` with Drizzle `sql`

3. Update `packages/db/src/column-types.ts`
   - Convert to Drizzle column type definitions
   - Maintain JSONB type safety

4. Update type exports
   - Replace `types.gen.ts` with schema-based types
   - Create type helper exports

**Deliverables:**
- ✅ Database package fully migrated
- ✅ All exports updated
- ✅ Type system working

#### Phase 3: Context & Setup Migration (Day 5)
**Goal:** Update application entry points

**Tasks:**
1. Update `packages/api/src/context.ts`
   - Change `db: Kysely<DB>` → `db: ReturnType<typeof setupDrizzle>`

2. Update `apps/web/src/server/db.ts`
   - Replace `setupDb` with `setupDrizzle`

3. Update `apps/web/src/server/create-auth.ts`
   - Update DB type references

**Deliverables:**
- ✅ Application context updated
- ✅ Database instances created with Drizzle

#### Phase 4: Query Migration (Days 6-10)
**Goal:** Migrate all database queries

**Migration Order (by complexity):**

**Batch 1: Simple Queries (Day 6)**
- `packages/api/src/helpers/users.ts` - 4 queries
- `apps/web/src/pages/api/github/app/callback.ts` - 1 query
- `apps/trigger/src/tasks/test-story.ts` - 1 query

**Batch 2: Medium Complexity (Days 7-8)**
- `packages/api/src/routers/org.ts` - 3 queries
- `packages/api/src/routers/run.ts` - 4 queries
- `packages/api/src/routers/repo.ts` - 6 queries (includes CTE)

**Batch 3: Complex Queries (Days 9-10)**
- `packages/api/src/routers/story.ts` - 9 queries
- `packages/api/src/helpers/memberships.ts` - 4 queries (complex joins)
- `apps/trigger/src/tasks/github/shared/db.ts` - 21 queries
- `apps/trigger/src/tasks/ci/setup.ts` - 2 queries
- `apps/trigger/src/tasks/ci/sandbox.ts` - 4 queries
- `apps/trigger/src/tasks/ci/results.ts` - 2 queries
- `apps/trigger/src/tasks/story-decomposition.ts` - 2 queries
- `apps/trigger/src/tasks/sync-github-installation.ts` - 3 queries

**Migration Process per File:**
1. Read file and identify all queries
2. Convert each query to Drizzle syntax
3. Update type imports
4. Test query execution
5. Verify results match expected output
6. Commit changes

**Deliverables:**
- ✅ All queries migrated
- ✅ All tests passing
- ✅ No Kysely imports remaining

#### Phase 5: Cleanup (Days 11-12)
**Goal:** Remove Kysely dependencies and finalize

**Tasks:**
1. Remove Kysely packages
   ```bash
   pnpm remove kysely kysely-codegen --filter @app/db
   ```

2. Remove Kysely-specific files
   - Delete `packages/db/src/types.gen.ts`
   - Remove `.kysely-codegenrc.yaml` if exists
   - Clean up unused imports

3. Update package.json scripts
   - Replace `db:codegen` with Drizzle Kit commands
   - Update migration scripts

4. Update documentation
   - Update `.cursor/rules/database.mdc`
   - Update README if needed

5. Final testing
   - Run full test suite
   - Verify all queries work
   - Check type inference

**Deliverables:**
- ✅ Kysely completely removed
- ✅ Documentation updated
- ✅ All tests passing

---

## 5. Risk Assessment

### 5.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Type inference differences | Medium | Medium | Test type exports early, use explicit types where needed |
| JSONB handling changes | Low | Low | Drizzle supports JSONB natively, test custom types |
| Neon serverless compatibility | Medium | Low | Drizzle supports Neon, verify connection pooling |
| Query performance differences | Low | Low | Both generate similar SQL, profile if needed |
| Migration script issues | Low | Medium | Test migrations on dev database first |

### 5.2 Process Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes during migration | High | Medium | Migrate incrementally, test after each file |
| Type errors cascade | Medium | Medium | Fix types as you go, don't defer |
| Time overrun | Medium | Medium | Focus on high-value files first, defer edge cases |

### 5.3 Mitigation Strategies

1. **Incremental Migration:** Migrate one file at a time, test immediately
2. **Parallel Testing:** Keep Kysely code until Drizzle is verified
3. **Type Safety:** Use TypeScript strict mode, fix errors immediately
4. **Query Verification:** Compare SQL output between Kysely and Drizzle
5. **Rollback Plan:** Git branches allow easy rollback if needed

---

## 6. Implementation Plan

### 6.1 Prerequisites

- [ ] Review Drizzle ORM documentation
- [ ] Set up test database for migration testing
- [ ] Create feature branch: `feat/drizzle-migration`
- [ ] Ensure all current tests pass

### 6.2 Step-by-Step Checklist

#### Phase 1: Foundation
- [ ] Install Drizzle packages
- [ ] Create `packages/db/src/schema.ts` from `schema.sql`
- [ ] Define all tables with proper types
- [ ] Create `drizzle.config.ts`
- [ ] Generate initial migration
- [ ] Update `packages/db/src/db.ts` with Drizzle setup
- [ ] Test database connection

#### Phase 2: Core Package
- [ ] Update `packages/db/src/index.ts` exports
- [ ] Migrate `packages/db/src/utils.ts`
- [ ] Update `packages/db/src/column-types.ts`
- [ ] Create type helper exports
- [ ] Test package exports

#### Phase 3: Context & Setup
- [ ] Update `packages/api/src/context.ts`
- [ ] Update `apps/web/src/server/db.ts`
- [ ] Update `apps/web/src/server/create-auth.ts`
- [ ] Test application startup

#### Phase 4: Query Migration
- [ ] Migrate `packages/api/src/helpers/users.ts`
- [ ] Migrate `packages/api/src/routers/org.ts`
- [ ] Migrate `packages/api/src/routers/run.ts`
- [ ] Migrate `packages/api/src/routers/repo.ts`
- [ ] Migrate `packages/api/src/routers/story.ts`
- [ ] Migrate `packages/api/src/helpers/memberships.ts`
- [ ] Migrate `apps/trigger/src/tasks/github/shared/db.ts`
- [ ] Migrate remaining trigger tasks
- [ ] Migrate web API routes

#### Phase 5: Cleanup
- [ ] Remove Kysely packages
- [ ] Delete Kysely-specific files
- [ ] Update package.json scripts
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Code review
- [ ] Merge to main

### 6.3 Testing Strategy

**Unit Tests:**
- Test each migrated query function individually
- Verify return types match expectations
- Test error cases

**Integration Tests:**
- Test full query flows
- Verify data consistency
- Test transactions

**E2E Tests:**
- Test critical user flows
- Verify API endpoints work
- Test trigger tasks

**Performance Tests:**
- Compare query execution times
- Profile complex queries
- Verify connection pooling

---

## 7. Success Criteria

### 7.1 Functional Requirements

- ✅ All database queries execute successfully
- ✅ All API endpoints return correct data
- ✅ All trigger tasks execute correctly
- ✅ Type safety maintained throughout
- ✅ No runtime errors in production

### 7.2 Technical Requirements

- ✅ Zero Kysely dependencies remaining
- ✅ All TypeScript types properly inferred
- ✅ Migration scripts work correctly
- ✅ Connection pooling functional
- ✅ Neon serverless compatibility verified

### 7.3 Quality Requirements

- ✅ All existing tests pass
- ✅ Code follows project conventions
- ✅ Documentation updated
- ✅ No performance regressions
- ✅ Type errors resolved

---

## 8. Timeline Estimate

### 8.1 Effort Breakdown

| Phase | Duration | Complexity | Risk |
|-------|----------|------------|------|
| Phase 1: Foundation | 2 days | Medium | Low |
| Phase 2: Core Package | 2 days | Medium | Medium |
| Phase 3: Context & Setup | 1 day | Low | Low |
| Phase 4: Query Migration | 5 days | High | Medium |
| Phase 5: Cleanup | 2 days | Low | Low |
| **Total** | **12 days** | **Medium-High** | **Low-Medium** |

### 8.2 Buffer & Contingency

- **Base Estimate:** 12 days
- **Buffer (20%):** +2.4 days
- **Contingency:** +1.6 days
- **Total Estimate:** **~16 days (3-4 weeks calendar time)**

### 8.3 Dependencies

- No external dependencies
- Can be done incrementally
- No blocking issues expected

---

## 9. Appendix

### 9.1 Key Files to Migrate

**Core Database Package:**
- `packages/db/src/db.ts`
- `packages/db/src/index.ts`
- `packages/db/src/utils.ts`
- `packages/db/src/column-types.ts`
- `packages/db/src/types.gen.ts` (delete)

**API Package:**
- `packages/api/src/context.ts`
- `packages/api/src/routers/*.ts` (5 files)
- `packages/api/src/helpers/*.ts` (4 files)

**Trigger App:**
- `apps/trigger/src/tasks/**/*.ts` (multiple files)

**Web App:**
- `apps/web/src/server/db.ts`
- `apps/web/src/server/create-auth.ts`
- `apps/web/src/pages/api/**/*.ts` (1 file)

### 9.2 Reference Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Guide](https://orm.drizzle.team/docs/get-started-postgresql)
- [Neon Integration](https://neon.tech/docs/serverless/serverless-driver)

### 9.3 Migration Examples

See Section 3.2 for detailed pattern translations.

### 9.4 Rollback Plan

If migration fails:
1. Revert to previous git commit
2. Restore Kysely dependencies
3. Verify application functionality
4. Document issues encountered
5. Plan remediation

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-27 | Proceed with migration | API differences are manageable, benefits outweigh costs |
| 2025-01-27 | Use incremental migration | Lower risk, easier to test and verify |
| 2025-01-27 | Keep Neon/Postgres support | No changes needed to connection pooling |

---

**Document Status:** Ready for Review  
**Next Steps:** Get approval, create feature branch, begin Phase 1

