# Database Driver Evaluation

This document records the stage 10 database migration decision points. The current production stack remains
Knex + `sqlite3` until a replacement passes parity tests against existing user database behavior.

## Runtime Baseline

- Production runtime target: Node.js 24 LTS.
- Optional spike runtime: Node.js 26 Current.
- Node.js 26 can be used to evaluate the newest `node:sqlite` behavior, but it should not become the production
  target before it enters LTS.
- As of the current Node.js 26.3.0 documentation, `node:sqlite` is still marked as release candidate.

## Local Runtime Probe

The current development environment is Node.js `v24.16.0`.

Basic `node:sqlite` smoke test result:

- `require('node:sqlite')` works.
- `DatabaseSync(':memory:')` can create a table, insert a row, query it back, and close.

This confirms availability on the current LTS runtime, but it does not prove production suitability. Repository
parity, migration compatibility, and blocking behavior still need dedicated tests before replacing Knex + `sqlite3`.

## Current Database Baseline

- Current database access: Knex query builder with the `sqlite3` driver.
- Current compatibility surface:
  - Existing `database/migrations` and `knex_migrations`.
  - `staticMetadata` view output shape.
  - SQLite JSON aggregation fields consumed by API normalization.
  - `INSERT OR IGNORE` behavior for metadata and reviews.
  - Transaction behavior during scan, update, remove, review, and user operations.
  - `PRAGMA foreign_keys = ON` and configurable busy timeout.

## Candidate Drivers

### Keep Knex + sqlite3

Lowest migration risk. This keeps the current async API, query builder behavior, migration tooling, and test
fixtures unchanged.

Costs:

- Keeps a native dependency.
- Keeps older Knex APIs and query-builder-specific behavior in repositories.
- Does not move the schema toward stronger TypeScript modeling by itself.

### Knex + better-sqlite3

Moderate migration risk. Knex documents `better-sqlite3` as a SQLite client option, and it could reduce callback
driver complexity while keeping much of the query builder.

Validation required:

- Knex migration compatibility.
- Transaction and busy timeout behavior.
- Blocking impact during scan/update while HTTP media/API requests are active.

### Drizzle + node:sqlite

Promising long-term candidate. Drizzle documents native SQLite support through `node:sqlite`, `better-sqlite3`,
and `libsql`. Node's built-in `node:sqlite` removes third-party native SQLite packages, which is attractive for
install, Docker, and future packaging.

Risks:

- Node's `node:sqlite` API is synchronous.
- As of the current Node.js 26.3.0 documentation, `node:sqlite` is still marked release candidate rather than fully
  stable.
- Repository code cannot be moved mechanically because current queries depend on Knex builders, subqueries, raw
SQL, and view output shape.
- Existing migrations are Knex migrations; Drizzle migration adoption needs a separate migration story.

### Drizzle + better-sqlite3

Useful comparison candidate. It avoids depending on a release-candidate Node API while still testing Drizzle's
schema/query model.

Validation required:

- Same query parity checks as `node:sqlite`.
- Packaging and native dependency cost compared with current `sqlite3`.

## Decision

Do not replace the production database layer in one step.

Stage 10 should proceed as:

1. Build repository parity tests that can run against the current Knex implementation.
2. Add an isolated Drizzle schema and driver spike outside the production request path.
3. Compare `node:sqlite` and `better-sqlite3` against the same parity fixture.
4. Keep Knex if the replacement does not provide clear maintenance or packaging value.

## Parity Requirements

A candidate implementation must match current behavior for:

- `getWorkMetadata`
- `getWorksBy`
- `getWorksByKeyWord`
- `getWorksWithReviews`
- `insertWorkMetadata`
- `updateWorkMetadata`
- `removeWork`
- `createUser`
- `updateUserPassword`
- `deleteUser`
- database migration from historical fixtures
- `staticMetadata` result fields consumed by `src/shared/metadata/normalize.js`

## Notes

- `node:sqlite` should be treated as a spike target first, not a production replacement.
- Node.js 26 may be used for the spike, but production should remain on an LTS release line.
- If `node:sqlite` is selected later, synchronous database calls must be assessed under scan/update load.
- If Drizzle is selected later, keep old Knex migrations available for existing databases unless a tested migration
  bridge replaces them.
- Keep `database/migrations` at the repository root for now. It is a compatibility boundary for historical user
  databases, migration tests, package configuration, and migration logs.
