---
title: Prisma adapter integrity under schema changes
summary: Prevent duplicate columns, preserve row reads after schema changes, and reject unknown cell writes before changing data.
type: plan
status: in-progress
tags: [prisma, integrity, concurrency, testing]
projects: [data-table, receipt-ocr-app]
date: 2026-10-09
---

# Decision

Approved by the autonomous portfolio execution goal on 2026-10-09. Fix the three
adapter defects recorded in the receipts roadmap at their shared library home.
No production schema migration is needed.

- Serialize column creation and renaming per table through a PostgreSQL row lock.
  Reject a duplicate name explicitly. Create column metadata and its physical column
  in one transaction, so failure leaves neither an orphan nor a partial column.
- Select explicit system and scalar columns in row queries. A changed column list
  changes the statement text, so cached query result types remain valid. Database
  errors propagate; a failed query must never pretend the row is missing.
- Validate every input cell key before a row create or update. Unknown and
  cross-table column identifiers fail before any scalar or junction mutation.
- Repair the stale integration tests to the current adapter contract and run them
  against a disposable PostgreSQL database in continuous integration.

# Verification and completion

Exercise simultaneous same-name creation, failed column creation rollback,
rename collision, same name in independent tables, repeated reads before and
after add/drop, database failures, and mixed valid/unknown writes without partial
changes. Confirm state survives a fresh client, reversing a schema edit preserves
remaining values, and a failed operation can be retried with valid input.

Publish a patch release through the existing trusted publishing workflow after
review and merge. Upgrade receipts and verify its test suite and deployment,
coordinating with its original implementation owners. Retain receipts' local
workarounds until the consuming upgrade and production check are verified.
