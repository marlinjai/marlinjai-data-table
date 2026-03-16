/**
 * Column type to storage mapping.
 *
 * Determines which column types get real SQL columns vs. junction tables,
 * and handles serialization/deserialization between JS values and TEXT storage.
 */

import type { ColumnType, CellValue } from '@marlinjai/data-table-core';

/** Column types stored as TEXT columns in the real table */
const SCALAR_TYPES: ReadonlySet<ColumnType> = new Set([
  'text',
  'number',
  'date',
  'boolean',
  'url',
  'select',
  'created_time',
  'last_edited_time',
]);

/** Column types stored in junction tables (not in the real table) */
const JUNCTION_TYPES: ReadonlySet<ColumnType> = new Set([
  'multi_select',
  'relation',
  'file',
]);

/** Column types computed at read time (no storage) */
const COMPUTED_TYPES: ReadonlySet<ColumnType> = new Set([
  'formula',
  'rollup',
]);

/**
 * Returns true if this column type should have a real TEXT column in the table.
 */
export function isScalarType(type: ColumnType): boolean {
  return SCALAR_TYPES.has(type);
}

/**
 * Returns true if this column type uses junction tables for storage.
 */
export function isJunctionType(type: ColumnType): boolean {
  return JUNCTION_TYPES.has(type);
}

/**
 * Returns true if this column type is computed at read time.
 */
export function isComputedType(type: ColumnType): boolean {
  return COMPUTED_TYPES.has(type);
}

/**
 * Serialize a CellValue to a TEXT string for database storage.
 * Returns null for null/undefined values.
 */
export function serializeCell(value: CellValue, type: ColumnType): string | null {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'text':
    case 'url':
    case 'select':
      return String(value);

    case 'number':
      if (typeof value === 'number') return String(value);
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) return null;
        return String(parsed);
      }
      return null;

    case 'boolean':
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (value === 'true' || value === 'false') return value;
      return null;

    case 'date':
    case 'created_time':
    case 'last_edited_time':
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value; // Assume ISO 8601
      return null;

    default:
      // Junction and computed types should not be serialized to a column
      return null;
  }
}

/**
 * Deserialize a TEXT string from the database to the appropriate JS type.
 * Returns null for null/undefined values or values that can't be parsed.
 */
export function deserializeCell(raw: string | null, type: ColumnType): CellValue {
  if (raw === null || raw === undefined) return null;

  switch (type) {
    case 'text':
    case 'url':
    case 'select':
      return raw;

    case 'number': {
      const num = Number(raw);
      return Number.isNaN(num) ? null : num;
    }

    case 'boolean':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return null;

    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return raw; // Return ISO string — let the UI format it

    default:
      return raw;
  }
}
