/**
 * Schema self-healing: verify consistency between metadata and real table structure.
 *
 * Detects drift between dt_columns metadata and actual SQL table columns.
 * Provides repair functions to add missing columns.
 */

import type { Column } from '@marlinjai/data-table-core';
import { safeTableName, safeColumnName } from './identifiers.js';
import { isScalarType } from './type-mapping.js';

export interface SchemaReport {
  tableId: string;
  tableName: string;
  /** Columns in metadata but missing from the real table */
  missingInTable: string[];
  /** Columns in the real table but not in metadata (orphans) */
  orphansInTable: string[];
  /** True if metadata and table are consistent */
  isConsistent: boolean;
}

/** System columns that exist in every real table (not from dt_columns metadata) */
const SYSTEM_COLUMNS = new Set(['id', '_archived', '_created_at', '_updated_at', 'parent_row_id']);

/**
 * Verify schema consistency between metadata columns and real table columns.
 *
 * @param tableId - The table ID
 * @param metadataColumns - Columns from dt_columns metadata
 * @param actualColumnNames - Column names actually present in the real SQL table
 */
export function verifySchemaConsistency(
  tableId: string,
  metadataColumns: Column[],
  actualColumnNames: string[],
): SchemaReport {
  const tableName = safeTableName(tableId);

  // Only scalar types should have real columns
  const expectedColumns = new Set(
    metadataColumns.filter((c) => isScalarType(c.type)).map((c) => c.id),
  );

  // Filter out system columns from actual columns
  const actualUserColumns = new Set(
    actualColumnNames.filter((name) => !SYSTEM_COLUMNS.has(name)),
  );

  const missingInTable: string[] = [];
  for (const colId of expectedColumns) {
    if (!actualUserColumns.has(colId)) {
      missingInTable.push(colId);
    }
  }

  const orphansInTable: string[] = [];
  for (const colName of actualUserColumns) {
    if (!expectedColumns.has(colName)) {
      orphansInTable.push(colName);
    }
  }

  return {
    tableId,
    tableName,
    missingInTable,
    orphansInTable,
    isConsistent: missingInTable.length === 0 && orphansInTable.length === 0,
  };
}

/**
 * Generate ALTER TABLE ADD COLUMN statements to repair missing columns.
 * Returns SQL strings that can be executed to add the missing columns.
 */
export function generateRepairStatements(report: SchemaReport): string[] {
  return report.missingInTable.map((colId) => {
    const colName = safeColumnName(colId);
    return `ALTER TABLE ${report.tableName} ADD COLUMN ${colName} TEXT`;
  });
}
