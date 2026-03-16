/**
 * Lazy per-table data migration from JSON blobs to real table columns.
 *
 * Each table is migrated on first access. Original dt_rows data is preserved
 * for rollback capability.
 */

import type { PrismaClient } from '@prisma/client';
import type { Column } from '@marlinjai/data-table-core';
import { safeTableName, safeColumnName, isScalarType } from '@marlinjai/data-table-adapter-shared';
import { createRealTable } from './ddl.js';

interface LegacyRow {
  id: string;
  table_id: string;
  cells: string | Record<string, unknown> | null;
  computed: string | Record<string, unknown> | null;
  _title: string | null;
  _archived: number;
  _created_at: string;
  _updated_at: string;
}

/**
 * Ensure a real table exists for the given table ID.
 * If not yet migrated, creates the real table and copies data from dt_rows.
 */
export async function ensureRealTable(
  prisma: PrismaClient,
  tableId: string,
): Promise<void> {
  // Check if already migrated
  const table = await prisma.dtTable.findUnique({ where: { id: tableId } });
  if (!table) throw new Error(`Table not found: ${tableId}`);
  if (table.migrated) return;

  // Get column metadata
  const columns = await prisma.dtColumn.findMany({ where: { tableId } });
  const scalarColumns = columns.filter((c) => isScalarType(c.type as Column['type']));

  // Create the real table
  await createRealTable(prisma, tableId, scalarColumns as unknown as Column[]);

  // Read legacy rows
  const legacyRows = await prisma.$queryRawUnsafe<LegacyRow[]>(
    `SELECT * FROM dt_rows WHERE table_id = $1`,
    tableId,
  );

  // Batch insert into real table
  const tableName = safeTableName(tableId);
  const BATCH_SIZE = 100;

  for (let i = 0; i < legacyRows.length; i += BATCH_SIZE) {
    const batch = legacyRows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const cells =
        typeof row.cells === 'string' ? JSON.parse(row.cells) : (row.cells ?? {});

      // Build column names and values for INSERT
      const colNames = ['id', '_archived', '_created_at', '_updated_at'];
      const placeholders = ['$1', '$2', '$3', '$4'];
      const values: unknown[] = [row.id, row._archived, row._created_at, row._updated_at];
      let paramIdx = 5;

      for (const col of scalarColumns) {
        const colName = safeColumnName(col.id);
        colNames.push(colName);
        placeholders.push(`$${paramIdx}`);
        values.push(cells[col.id] != null ? String(cells[col.id]) : null);
        paramIdx++;
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
        ...values,
      );
    }

    // Migrate multi_select values from JSON arrays to junction table
    for (const row of batch) {
      const cells =
        typeof row.cells === 'string' ? JSON.parse(row.cells) : (row.cells ?? {});

      for (const col of columns.filter((c) => c.type === 'multi_select')) {
        const optionIds = cells[col.id];
        if (Array.isArray(optionIds)) {
          for (const optionId of optionIds) {
            if (typeof optionId === 'string') {
              await prisma.dtRowSelectValue.upsert({
                where: {
                  rowId_columnId_optionId: {
                    rowId: row.id,
                    columnId: col.id,
                    optionId,
                  },
                },
                create: { rowId: row.id, columnId: col.id, optionId },
                update: {},
              });
            }
          }
        }
      }
    }
  }

  // Mark as migrated
  await prisma.dtTable.update({
    where: { id: tableId },
    data: { migrated: true },
  });
}

/**
 * Rollback a table migration: drop the real table and reset the migrated flag.
 * Original dt_rows data is still intact.
 */
export async function rollbackMigration(
  prisma: PrismaClient,
  tableId: string,
): Promise<void> {
  const tableName = safeTableName(tableId);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tableName}`);
  await prisma.dtTable.update({
    where: { id: tableId },
    data: { migrated: false },
  });
}
