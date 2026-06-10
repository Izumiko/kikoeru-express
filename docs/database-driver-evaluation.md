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

Local installation result:

- `better-sqlite3` installation failed after the prebuilt binary download hit `ECONNRESET`.
- The fallback build path used the repository's old `node-gyp@3.8.0`, which is incompatible with the available
  Python 3 runtime.
- Because installation is fragile on the current Windows + Node 24 environment, this candidate is not the preferred
  stage 10 spike target.

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

### Drizzle + libSQL

Preferred current spike target. Drizzle has a published `drizzle-orm/libsql` driver in the installed package, and
`@libsql/client` installs cleanly in the current environment.

Validation status:

- A local in-memory libSQL probe can execute the legacy table/view SQL.
- Drizzle can query typed tables through the libSQL driver.
- The legacy `staticMetadata` view shape can be reproduced.
- The isolated libSQL spike now covers the current repository parity baseline for:
  - metadata reads: `getWorkMetadata`, `getWorksBy`, `getWorksByKeyWord`, `getLabels`, `getMetadata`.
  - work writes: `insertWorkMetadata`, `updateWorkMetadata`, `removeWork`.
  - review reads/writes: `getWorksWithReviews`, `updateUserReview`, `deleteUserReview`.
  - user writes: `createUser`, `updateUserPassword`, `resetUserPassword`, `deleteUser`.

Validation still required:

- Migration story for existing Knex migrations and historical user databases.
- Production wiring plan for replacing Knex repositories without changing the public `database/db.js` facade.
- Blocking/performance behavior during scan/update while HTTP API and media requests are active.

Compatibility notes from the spike:

- `t_review.work_id` is a text column in the legacy schema even though it references numeric work ids. The libSQL
  spike must stringify review work ids before `INSERT OR IGNORE`, otherwise duplicate review rows can be inserted
  when parameter storage classes differ.
- The current Drizzle/libSQL spike still uses raw SQL for the complex repository queries. Drizzle is useful for
  schema modeling and typed simple table access, but the existing `staticMetadata` view and query shapes should not
  be mechanically rewritten until parity tests cover the production repository facade.

## Decision

Do not replace the production database layer in one step.

Stage 10 should proceed as:

1. Build repository parity tests that can run against the current Knex implementation.
2. Add an isolated Drizzle schema and driver spike outside the production request path.
3. Use libSQL as the current executable Drizzle spike target.
4. Keep root Knex migrations as the compatibility migration path unless a tested bridge replaces them.
5. Replace production repositories only behind the existing `database/db.js`/`src/database/repositories` facade.
6. Keep Knex if the replacement does not provide clear maintenance or packaging value.

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
- `staticMetadata` result fields consumed by `src/shared/metadata/normalize.js`
- database migration from historical fixtures

## Notes

- `node:sqlite` should be treated as a spike target first, not a production replacement.
- Node.js 26 may be used for the spike, but production should remain on an LTS release line.
- If `node:sqlite` is selected later, synchronous database calls must be assessed under scan/update load.
- If Drizzle is selected later, keep old Knex migrations available for existing databases unless a tested migration
  bridge replaces them.
- Keep `database/migrations` at the repository root for now. It is a compatibility boundary for historical user
  databases, migration tests, package configuration, and migration logs.
