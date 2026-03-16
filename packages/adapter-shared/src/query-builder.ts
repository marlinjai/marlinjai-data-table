/**
 * SQL query building utilities for real-table adapters.
 *
 * Builds WHERE clauses, ORDER BY, and CAST expressions for filtering
 * and sorting on TEXT columns with type-aware casting.
 */

import type { ColumnType, QueryFilter, QuerySort, Column } from '@marlinjai/data-table-core';
import { safeColumnName } from './identifiers.js';

export type DatabaseProvider = 'postgresql' | 'sqlite';

/**
 * Returns the SQL CAST expression to use for a column type on the given provider.
 */
export function buildCastExpression(
  columnRef: string,
  columnType: ColumnType,
  provider: DatabaseProvider,
): string {
  switch (columnType) {
    case 'number':
      return provider === 'postgresql'
        ? `(${columnRef})::NUMERIC`
        : `CAST(${columnRef} AS REAL)`;

    case 'date':
    case 'created_time':
    case 'last_edited_time':
      // ISO 8601 strings sort lexicographically, but explicit casting is safer
      return provider === 'postgresql'
        ? `(${columnRef})::TIMESTAMPTZ`
        : columnRef; // SQLite: ISO strings sort correctly as text

    case 'boolean':
      // "false" < "true" lexicographically — correct sort order
      return columnRef;

    default:
      return columnRef;
  }
}

/** Placeholder style: $1, $2 for PostgreSQL; ? for SQLite */
function placeholder(provider: DatabaseProvider, index: number): string {
  return provider === 'postgresql' ? `$${index}` : '?';
}

export interface WhereClauseResult {
  clause: string;
  params: unknown[];
  nextParamIndex: number;
}

/**
 * Builds a WHERE clause from filters for a real table.
 * Column IDs are validated, column references use the safe column name directly.
 *
 * @param filters - Array of query filters
 * @param columns - Map of column ID to column metadata (for type-aware casting)
 * @param provider - Database provider for SQL dialect
 * @param startParamIndex - Starting parameter index (default 1)
 */
export function buildWhereClause(
  filters: QueryFilter[],
  columns: Map<string, Column>,
  provider: DatabaseProvider,
  startParamIndex = 1,
): WhereClauseResult {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    const column = columns.get(filter.columnId);
    if (!column) {
      throw new Error(`Invalid filter column: ${filter.columnId}`);
    }

    const colName = safeColumnName(filter.columnId);
    const { operator, value } = filter;

    switch (operator) {
      case 'equals': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} = ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'notEquals': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} != ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'contains': {
        conditions.push(
          provider === 'postgresql'
            ? `${colName} ILIKE ${placeholder(provider, paramIndex)}`
            : `${colName} LIKE ${placeholder(provider, paramIndex)}`,
        );
        params.push(`%${value}%`);
        paramIndex++;
        break;
      }

      case 'notContains': {
        conditions.push(
          provider === 'postgresql'
            ? `${colName} NOT ILIKE ${placeholder(provider, paramIndex)}`
            : `${colName} NOT LIKE ${placeholder(provider, paramIndex)}`,
        );
        params.push(`%${value}%`);
        paramIndex++;
        break;
      }

      case 'startsWith': {
        conditions.push(
          provider === 'postgresql'
            ? `${colName} ILIKE ${placeholder(provider, paramIndex)}`
            : `${colName} LIKE ${placeholder(provider, paramIndex)}`,
        );
        params.push(`${value}%`);
        paramIndex++;
        break;
      }

      case 'endsWith': {
        conditions.push(
          provider === 'postgresql'
            ? `${colName} ILIKE ${placeholder(provider, paramIndex)}`
            : `${colName} LIKE ${placeholder(provider, paramIndex)}`,
        );
        params.push(`%${value}`);
        paramIndex++;
        break;
      }

      case 'greaterThan': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} > ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'greaterThanOrEquals': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} >= ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'lessThan': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} < ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'lessThanOrEquals': {
        const ref = buildCastExpression(colName, column.type, provider);
        conditions.push(`${ref} <= ${placeholder(provider, paramIndex)}`);
        params.push(value);
        paramIndex++;
        break;
      }

      case 'isEmpty':
        conditions.push(`(${colName} IS NULL OR ${colName} = '')`);
        break;

      case 'isNotEmpty':
        conditions.push(`(${colName} IS NOT NULL AND ${colName} != '')`);
        break;

      case 'isIn': {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            const p = placeholder(provider, paramIndex);
            paramIndex++;
            return p;
          });
          conditions.push(`${colName} IN (${placeholders.join(', ')})`);
          params.push(...value);
        }
        break;
      }

      case 'isNotIn': {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            const p = placeholder(provider, paramIndex);
            paramIndex++;
            return p;
          });
          conditions.push(`${colName} NOT IN (${placeholders.join(', ')})`);
          params.push(...value);
        }
        break;
      }
    }
  }

  return {
    clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
    params,
    nextParamIndex: paramIndex,
  };
}

/**
 * Builds an ORDER BY clause from sorts for a real table.
 * Uses CAST expressions for type-aware sorting (e.g., numeric sort for number columns).
 */
export function buildOrderBy(
  sorts: QuerySort[],
  columns: Map<string, Column>,
  provider: DatabaseProvider,
): string {
  if (sorts.length === 0) return '_created_at DESC';

  const clauses = sorts.map((sort) => {
    const column = columns.get(sort.columnId);
    if (!column) {
      throw new Error(`Invalid sort column: ${sort.columnId}`);
    }

    const colName = safeColumnName(sort.columnId);
    const ref = buildCastExpression(colName, column.type, provider);
    const direction = sort.direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return `${ref} ${direction}`;
  });

  return clauses.join(', ');
}
