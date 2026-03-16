import { describe, it, expect } from 'vitest';
import { buildWhereClause, buildOrderBy, buildCastExpression } from './query-builder.js';
import type { Column, QueryFilter, QuerySort } from '@marlinjai/data-table-core';

function makeColumn(id: string, type: Column['type']): Column {
  return {
    id,
    tableId: 'tbl_test',
    name: id,
    type,
    position: 0,
    width: 200,
    isPrimary: false,
    createdAt: new Date(),
  };
}

function columnsMap(cols: Column[]): Map<string, Column> {
  return new Map(cols.map((c) => [c.id, c]));
}

describe('buildCastExpression', () => {
  it('casts numbers for PostgreSQL', () => {
    expect(buildCastExpression('col_age', 'number', 'postgresql')).toBe('(col_age)::NUMERIC');
  });

  it('casts numbers for SQLite', () => {
    expect(buildCastExpression('col_age', 'number', 'sqlite')).toBe('CAST(col_age AS REAL)');
  });

  it('returns column as-is for text', () => {
    expect(buildCastExpression('col_name', 'text', 'postgresql')).toBe('col_name');
  });
});

describe('buildWhereClause', () => {
  const columns = columnsMap([
    makeColumn('col_name', 'text'),
    makeColumn('col_age', 'number'),
    makeColumn('col_active', 'boolean'),
  ]);

  it('returns 1=1 for no filters', () => {
    const result = buildWhereClause([], columns, 'postgresql');
    expect(result.clause).toBe('1=1');
    expect(result.params).toEqual([]);
  });

  it('builds equals filter', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_name', operator: 'equals', value: 'John' }];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe('col_name = $1');
    expect(result.params).toEqual(['John']);
  });

  it('builds numeric greaterThan with cast', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_age', operator: 'greaterThan', value: 18 }];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe('(col_age)::NUMERIC > $1');
    expect(result.params).toEqual([18]);
  });

  it('builds contains filter with ILIKE for PostgreSQL', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_name', operator: 'contains', value: 'oh' }];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe('col_name ILIKE $1');
    expect(result.params).toEqual(['%oh%']);
  });

  it('builds contains filter with LIKE for SQLite', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_name', operator: 'contains', value: 'oh' }];
    const result = buildWhereClause(filters, columns, 'sqlite');
    expect(result.clause).toBe('col_name LIKE ?');
    expect(result.params).toEqual(['%oh%']);
  });

  it('builds isEmpty filter', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_name', operator: 'isEmpty', value: null }];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe("(col_name IS NULL OR col_name = '')");
    expect(result.params).toEqual([]);
  });

  it('builds multiple filters with AND', () => {
    const filters: QueryFilter[] = [
      { columnId: 'col_name', operator: 'equals', value: 'John' },
      { columnId: 'col_age', operator: 'greaterThan', value: 18 },
    ];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe('col_name = $1 AND (col_age)::NUMERIC > $2');
    expect(result.params).toEqual(['John', 18]);
  });

  it('throws for invalid column ID', () => {
    const filters: QueryFilter[] = [{ columnId: 'nonexistent', operator: 'equals', value: 'x' }];
    expect(() => buildWhereClause(filters, columns, 'postgresql')).toThrow('Invalid filter column');
  });

  it('builds isIn filter', () => {
    const filters: QueryFilter[] = [
      { columnId: 'col_name', operator: 'isIn', value: ['a', 'b', 'c'] },
    ];
    const result = buildWhereClause(filters, columns, 'postgresql');
    expect(result.clause).toBe('col_name IN ($1, $2, $3)');
    expect(result.params).toEqual(['a', 'b', 'c']);
  });

  it('respects startParamIndex', () => {
    const filters: QueryFilter[] = [{ columnId: 'col_name', operator: 'equals', value: 'John' }];
    const result = buildWhereClause(filters, columns, 'postgresql', 5);
    expect(result.clause).toBe('col_name = $5');
    expect(result.nextParamIndex).toBe(6);
  });
});

describe('buildOrderBy', () => {
  const columns = columnsMap([
    makeColumn('col_name', 'text'),
    makeColumn('col_age', 'number'),
  ]);

  it('returns default order for empty sorts', () => {
    expect(buildOrderBy([], columns, 'postgresql')).toBe('_created_at DESC');
  });

  it('builds text sort', () => {
    const sorts: QuerySort[] = [{ columnId: 'col_name', direction: 'asc' }];
    expect(buildOrderBy(sorts, columns, 'postgresql')).toBe('col_name ASC');
  });

  it('builds numeric sort with cast', () => {
    const sorts: QuerySort[] = [{ columnId: 'col_age', direction: 'desc' }];
    expect(buildOrderBy(sorts, columns, 'postgresql')).toBe('(col_age)::NUMERIC DESC');
  });

  it('throws for invalid column ID', () => {
    const sorts: QuerySort[] = [{ columnId: 'nonexistent', direction: 'asc' }];
    expect(() => buildOrderBy(sorts, columns, 'postgresql')).toThrow('Invalid sort column');
  });
});
