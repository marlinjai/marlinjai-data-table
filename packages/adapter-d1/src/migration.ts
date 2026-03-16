/**
 * Lazy per-table migration for D1.
 *
 * Migrates from JSON blob (dt_rows) storage to real table columns.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Column } from '@marlinjai/data-table-core';
import { safeTableName, safeColumnName, isScalarType } from '@marlinjai/data-table-adapter-shared';
import { createRealTableD1 } from './ddl-compat.js';

interface D1TableMeta {
  id: string;
  migrated: number;
}

interface LegacyRow {
  id: string;
  table_id: string;
  cells: string;
  _archived: number;
  _created_at: string;
  _updated_at: string;
}

interface D1ColumnMeta {
  id: string;
  table_id: string;
  type: string;
}

/**
 * Ensure a real table exists for D1. Migrates data lazily on first access.
 */
export async function ensureRealTableD1(
  db: D1Database,
  tableId: string,
): Promise<void> {
  const table = await db
    .prepare('SELECT id, migrated FROM dt_tables WHERE id = ?')
    .bind(tableId)
    .first<D1TableMeta>();

  if (!table) throw new Error(`Table not found: ${tableId}`);
  if (table.migrated === 1) return;

  // Get column metadata
  const columnsResult = await db
    .prepare('SELECT id, table_id, type FROM dt_columns WHERE table_id = ?')
    .bind(tableId)
    .all<D1ColumnMeta>();
  const columns = columnsResult.results;
  const scalarColumns = columns.filter((c) => isScalarType(c.type as Column['type']));

  // Create the real table
  await createRealTableD1(db, tableId, scalarColumns as unknown as Column[]);

  // Read legacy rows
  const legacyResult = await db
    .prepare('SELECT * FROM dt_rows WHERE table_id = ?')
    .bind(tableId)
    .all<LegacyRow>();

  const tableName = safeTableName(tableId);

  // Batch insert into real table
  for (const row of legacyResult.results) {
    const cells = JSON.parse(row.cells || '{}');

    const colNames = ['id', '_archived', '_created_at', '_updated_at'];
    const placeholders = ['?', '?', '?', '?'];
    const values: unknown[] = [row.id, row._archived, row._created_at, row._updated_at];

    for (const col of scalarColumns) {
      const colName = safeColumnName(col.id);
      colNames.push(colName);
      placeholders.push('?');
      values.push(cells[col.id] != null ? String(cells[col.id]) : null);
    }

    await db
      .prepare(
        `INSERT OR IGNORE INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      )
      .bind(...values)
      .run();

    // Migrate multi_select values
    for (const col of columns.filter((c) => c.type === 'multi_select')) {
      const optionIds = cells[col.id];
      if (Array.isArray(optionIds)) {
        for (const optionId of optionIds) {
          if (typeof optionId === 'string') {
            await db
              .prepare(
                `INSERT OR IGNORE INTO dt_row_select_values (id, row_id, column_id, option_id) VALUES (?, ?, ?, ?)`,
              )
              .bind(crypto.randomUUID(), row.id, col.id, optionId)
              .run();
          }
        }
      }
    }
  }

  // Mark as migrated
  await db
    .prepare('UPDATE dt_tables SET migrated = 1 WHERE id = ?')
    .bind(tableId)
    .run();
}
