import { describe, it, expect } from 'vitest';
import { verifySchemaConsistency, generateRepairStatements } from './schema-verify.js';
import type { Column } from '@marlinjai/data-table-core';

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

describe('verifySchemaConsistency', () => {
  it('reports consistent when all scalar columns present', () => {
    const columns = [makeColumn('col_name', 'text'), makeColumn('col_age', 'number')];
    const actual = ['id', '_archived', '_created_at', '_updated_at', 'parent_row_id', 'col_name', 'col_age'];

    const report = verifySchemaConsistency('tbl_test', columns, actual);
    expect(report.isConsistent).toBe(true);
    expect(report.missingInTable).toEqual([]);
    expect(report.orphansInTable).toEqual([]);
  });

  it('ignores junction types in consistency check', () => {
    const columns = [
      makeColumn('col_name', 'text'),
      makeColumn('col_tags', 'multi_select'),
      makeColumn('col_files', 'file'),
    ];
    const actual = ['id', '_archived', '_created_at', '_updated_at', 'parent_row_id', 'col_name'];

    const report = verifySchemaConsistency('tbl_test', columns, actual);
    expect(report.isConsistent).toBe(true);
  });

  it('detects missing columns', () => {
    const columns = [makeColumn('col_name', 'text'), makeColumn('col_age', 'number')];
    const actual = ['id', '_archived', '_created_at', '_updated_at', 'parent_row_id', 'col_name'];

    const report = verifySchemaConsistency('tbl_test', columns, actual);
    expect(report.isConsistent).toBe(false);
    expect(report.missingInTable).toEqual(['col_age']);
  });

  it('detects orphan columns', () => {
    const columns = [makeColumn('col_name', 'text')];
    const actual = ['id', '_archived', '_created_at', '_updated_at', 'parent_row_id', 'col_name', 'col_old'];

    const report = verifySchemaConsistency('tbl_test', columns, actual);
    expect(report.isConsistent).toBe(false);
    expect(report.orphansInTable).toEqual(['col_old']);
  });
});

describe('generateRepairStatements', () => {
  it('generates ALTER TABLE ADD COLUMN for missing columns', () => {
    const report = {
      tableId: 'tbl_test',
      tableName: 'tbl_test',
      missingInTable: ['col_age', 'col_email'],
      orphansInTable: [],
      isConsistent: false,
    };

    const stmts = generateRepairStatements(report);
    expect(stmts).toEqual([
      'ALTER TABLE tbl_test ADD COLUMN col_age TEXT',
      'ALTER TABLE tbl_test ADD COLUMN col_email TEXT',
    ]);
  });

  it('returns empty array when nothing to repair', () => {
    const report = {
      tableId: 'tbl_test',
      tableName: 'tbl_test',
      missingInTable: [],
      orphansInTable: [],
      isConsistent: true,
    };

    expect(generateRepairStatements(report)).toEqual([]);
  });
});
