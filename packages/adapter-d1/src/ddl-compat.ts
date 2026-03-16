/**
 * D1-specific DDL compatibility layer.
 *
 * D1 has limited ALTER TABLE support — no DROP COLUMN, no RENAME COLUMN.
 * This module provides table-rebuild fallbacks for these operations.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { safeTableName, safeColumnName } from '@marlinjai/data-table-adapter-shared';
import type { Column } from '@marlinjai/data-table-core';
import { isScalarType } from '@marlinjai/data-table-adapter-shared';

/**
 * Create a real table for D1.
 */
export async function createRealTableD1(
  db: D1Database,
  tableId: string,
  scalarColumns: Column[],
): Promise<void> {
  const tableName = safeTableName(tableId);

  const userColumnDefs = scalarColumns
    .filter((c) => isScalarType(c.type))
    .map((c) => `${safeColumnName(c.id)} TEXT`)
    .join(',\n      ');

  const columnDefsClause = userColumnDefs ? `,\n      ${userColumnDefs}` : '';

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      _archived INTEGER NOT NULL DEFAULT 0,
      _created_at TEXT NOT NULL,
      _updated_at TEXT NOT NULL,
      parent_row_id TEXT${columnDefsClause}
    )`,
    )
    .run();
}

/**
 * Drop a real table.
 */
export async function dropRealTableD1(
  db: D1Database,
  tableId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  await db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
}

/**
 * Add a column to a real table in D1.
 */
export async function addColumnD1(
  db: D1Database,
  tableId: string,
  columnId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colName = safeColumnName(columnId);
  await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${colName} TEXT`).run();
}

/**
 * Drop a column from a real table using table-rebuild fallback.
 * D1 doesn't support ALTER TABLE DROP COLUMN natively.
 */
export async function dropColumnD1(
  db: D1Database,
  tableId: string,
  columnId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  const colToDrop = safeColumnName(columnId);

  // Get all current columns
  const tableInfo = await db.prepare(`PRAGMA table_info(${tableName})`).all<{
    name: string;
    type: string;
  }>();

  const allColumns = tableInfo.results.map((c) => c.name);
  const remaining = allColumns.filter((c) => c !== colToDrop);

  if (remaining.length === allColumns.length) return; // Column doesn't exist

  const columnList = remaining.join(', ');

  // Table-rebuild: create backup, drop original, rename backup
  await db.batch([
    db.prepare(`CREATE TABLE ${tableName}_backup AS SELECT ${columnList} FROM ${tableName}`),
    db.prepare(`DROP TABLE ${tableName}`),
    db.prepare(`ALTER TABLE ${tableName}_backup RENAME TO ${tableName}`),
  ]);
}

/**
 * Get actual column names from a D1 real table.
 */
export async function getTableColumnNamesD1(
  db: D1Database,
  tableId: string,
): Promise<string[]> {
  const tableName = safeTableName(tableId);
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all<{
    name: string;
  }>();
  return result.results.map((r) => r.name);
}
