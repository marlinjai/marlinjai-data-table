/**
 * DDL operations for PostgreSQL via Prisma.
 *
 * Creates/drops real tables and columns. Uses transactional DDL
 * where possible (PostgreSQL supports this).
 */

import type { PrismaClient } from '@prisma/client';
import type { Column } from '@marlinjai/data-table-core';
import {
  safeTableName,
  safeColumnName,
  isScalarType,
} from '@marlinjai/data-table-adapter-shared';

/**
 * Create a real table for a data-table table.
 * System columns (id, _archived, _created_at, _updated_at, parent_row_id) are always created.
 * Scalar user columns are added as TEXT.
 */
export async function createRealTable(
  prisma: PrismaClient,
  tableId: string,
  scalarColumns: Column[],
): Promise<void> {
  const tableName = safeTableName(tableId);

  const userColumnDefs = scalarColumns
    .filter((c) => isScalarType(c.type))
    .map((c) => `${safeColumnName(c.id)} TEXT`)
    .join(',\n      ');

  const columnDefsClause = userColumnDefs ? `,\n      ${userColumnDefs}` : '';

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      _archived INTEGER NOT NULL DEFAULT 0,
      _created_at TEXT NOT NULL,
      _updated_at TEXT NOT NULL,
      parent_row_id TEXT${columnDefsClause}
    )
  `);
}

/**
 * Drop a real table.
 */
export async function dropRealTable(
  prisma: PrismaClient,
  tableId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tableName}`);
}

/**
 * Add a column to a real table.
 * Uses transactional DDL on PostgreSQL: DDL + metadata in one transaction.
 */
export async function addColumn(
  prisma: PrismaClient,
  tableId: string,
  columnId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colName = safeColumnName(columnId);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} TEXT`,
  );
}

/**
 * Drop a column from a real table.
 */
export async function dropColumn(
  prisma: PrismaClient,
  tableId: string,
  columnId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colName = safeColumnName(columnId);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName}`,
  );
}

/**
 * Create an expression index for type-aware filtering/sorting.
 */
export async function createExpressionIndex(
  prisma: PrismaClient,
  tableId: string,
  columnId: string,
  columnType: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colName = safeColumnName(columnId);
  const indexName = `idx_${tableName}_${colName}_typed`;

  let expression: string;
  switch (columnType) {
    case 'number':
      expression = `((${colName})::NUMERIC)`;
      break;
    case 'date':
    case 'created_time':
    case 'last_edited_time':
      expression = `((${colName})::TIMESTAMPTZ)`;
      break;
    default:
      return; // No expression index needed for text types
  }

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} ${expression}`,
  );
}

/**
 * Drop an expression index.
 */
export async function dropExpressionIndex(
  prisma: PrismaClient,
  tableId: string,
  columnId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colName = safeColumnName(columnId);
  const indexName = `idx_${tableName}_${colName}_typed`;
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${indexName}`);
}

/**
 * Atomically execute DDL + metadata operations in a transaction.
 * PostgreSQL supports transactional DDL, so both succeed or both fail.
 */
export async function atomicDDL(
  prisma: PrismaClient,
  ddlFn: (tx: PrismaClient) => Promise<void>,
  metadataFn: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await ddlFn(tx as unknown as PrismaClient);
    await metadataFn(tx as unknown as PrismaClient);
  });
}

/**
 * Get the list of actual column names from a real table using information_schema.
 */
export async function getTableColumnNames(
  prisma: PrismaClient,
  tableId: string,
): Promise<string[]> {
  const tableName = safeTableName(tableId);
  const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    tableName,
  );
  return result.map((r) => r.column_name);
}
