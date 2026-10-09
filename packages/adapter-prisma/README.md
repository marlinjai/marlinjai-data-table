# Prisma data-table adapter

PostgreSQL storage for the shared data-table interface. Scalar cells live in a
physical table per data table; file references, selections, and relations live
in junction tables.

## Integrity guarantees

- Column creation and renaming serialize per table. An existing column name
  produces an explicit error. Applications that ensure columns on startup should
  re-read the schema after a competing creator wins.
- Column metadata and physical column creation commit together. A failed creation
  can be retried without leaving duplicate metadata or an orphan physical column.
- Row reads use explicit projections, so adding or dropping a column does not
  invalidate the result shape of an already prepared query. Database failures
  propagate; only a successful search without a matching row returns `null`.
- Unknown column identifiers in row creation or updates are rejected before any
  row or selection changes. A column from another table is unknown in this table.

Version 0.2.3 requires no metadata migration and does not rewrite existing data.
The duplicate-name check covers writes through this adapter. Code bypassing the
adapter must enforce equivalent integrity constraints itself.

## Database tests

Use a dedicated disposable PostgreSQL database. Set `TEST_DATABASE_URL` to a
local connection whose database name ends in `_test`, then run `pnpm test:db`
from this package. That command resets the database to the package schema and
runs the integration tests. `pnpm test` alone reuses an already prepared schema;
without `TEST_DATABASE_URL`, database tests are skipped.

Tests prove concurrent schema operations, rollback and retry, reads across
schema edits and new client connections, propagated database errors, and
rejected unknown writes without partial changes. Continuous integration always
runs them against its own disposable database.
