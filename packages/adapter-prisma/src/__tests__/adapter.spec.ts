/**
 * Integration tests for PrismaAdapter.
 *
 * Requires a running PostgreSQL instance. Set DATABASE_URL to connect.
 * Tests are skipped when no database is available.
 *
 * Run: DATABASE_URL="postgresql://user:pass@localhost:5432/test_db" pnpm test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from '../adapter.js';
import type { Table, Column, Row } from '@marlinjai/data-table-core';

const DATABASE_URL = process.env.DATABASE_URL;

const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('PrismaAdapter', () => {
  let prisma: PrismaClient;
  let adapter: PrismaAdapter;
  const workspaceId = 'test-workspace-1';

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });
    await prisma.$connect();

    // Run Prisma schema push to ensure tables exist
    const { execSync } = await import('child_process');
    execSync('npx prisma db push --force-reset --skip-generate', {
      cwd: new URL('../../..', import.meta.url).pathname,
      env: { ...process.env, DATABASE_URL },
      stdio: 'pipe',
    });

    adapter = new PrismaAdapter({ prisma });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Clean up between tests
  beforeEach(async () => {
    // Delete all metadata
    await prisma.dtFile.deleteMany();
    await prisma.dtRelation.deleteMany();
    await prisma.dtRowSelectValue.deleteMany();
    await prisma.selectOption.deleteMany();
    await prisma.dtView.deleteMany();
    await prisma.dtColumn.deleteMany();
    await prisma.dtRow.deleteMany();
    await prisma.dtTable.deleteMany();

    // Drop any real tables from previous runs
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'tbl_%'`,
    );
    for (const t of tables) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t.tablename}" CASCADE`);
    }
  });

  // =========================================================================
  // Table CRUD
  // =========================================================================

  describe('Tables', () => {
    it('should create a table', async () => {
      const table = await adapter.createTable({
        workspaceId,
        name: 'Contacts',
      });

      expect(table).toBeDefined();
      expect(table.name).toBe('Contacts');
      expect(table.id).toBeTruthy();
    });

    it('should list tables for a workspace', async () => {
      await adapter.createTable({ workspaceId, name: 'Table A' });
      await adapter.createTable({ workspaceId, name: 'Table B' });
      await adapter.createTable({ workspaceId: 'other-ws', name: 'Table C' });

      const tables = await adapter.listTables(workspaceId);
      expect(tables).toHaveLength(2);
      expect(tables.map((t) => t.name).sort()).toEqual(['Table A', 'Table B']);
    });

    it('should get a table by id', async () => {
      const created = await adapter.createTable({ workspaceId, name: 'My Table' });
      const fetched = await adapter.getTable(created.id);
      expect(fetched.name).toBe('My Table');
    });

    it('should update a table', async () => {
      const table = await adapter.createTable({ workspaceId, name: 'Old Name' });
      const updated = await adapter.updateTable(table.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should delete a table and its real SQL table', async () => {
      const table = await adapter.createTable({ workspaceId, name: 'To Delete' });

      // Create a column to trigger real table creation
      await adapter.createColumn({
        tableId: table.id,
        name: 'Name',
        type: 'text',
      });

      await adapter.deleteTable(table.id);

      // Verify metadata is gone
      await expect(adapter.getTable(table.id)).rejects.toThrow();

      // Verify real table is dropped
      const tables = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM pg_tables WHERE tablename = $1`,
        `tbl_${table.id.replace(/-/g, '')}`,
      );
      expect(Number(tables[0].count)).toBe(0);
    });
  });

  // =========================================================================
  // Column CRUD (ghost column regression test)
  // =========================================================================

  describe('Columns', () => {
    let tableId: string;

    beforeEach(async () => {
      const table = await adapter.createTable({ workspaceId, name: 'Test Table' });
      tableId = table.id;
    });

    it('should create a scalar column without ghost columns', async () => {
      const column = await adapter.createColumn({
        tableId,
        name: 'Email',
        type: 'text',
      });

      expect(column.name).toBe('Email');
      expect(column.type).toBe('text');

      // Verify the real SQL table has exactly the expected columns
      const sqlCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        `tbl_${tableId.replace(/-/g, '')}`,
      );
      const colNames = sqlCols.map((c) => c.column_name);

      // Should have: id, _archived, _created_at, _updated_at, parent_row_id, and the one user column
      expect(colNames).toContain(`col_${column.id.replace(/-/g, '')}`);
      // Should NOT have any extra ghost columns
      const userCols = colNames.filter((n) => n.startsWith('col_'));
      expect(userCols).toHaveLength(1);
    });

    it('should create multiple columns without ghost accumulation', async () => {
      const col1 = await adapter.createColumn({ tableId, name: 'Name', type: 'text' });
      const col2 = await adapter.createColumn({ tableId, name: 'Age', type: 'number' });
      const col3 = await adapter.createColumn({ tableId, name: 'Active', type: 'boolean' });

      const sqlCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        `tbl_${tableId.replace(/-/g, '')}`,
      );
      const userCols = sqlCols.map((c) => c.column_name).filter((n) => n.startsWith('col_'));
      expect(userCols).toHaveLength(3);
    });

    it('should not create real column for junction types', async () => {
      const col = await adapter.createColumn({ tableId, name: 'Tags', type: 'multi_select' });

      const sqlCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        `tbl_${tableId.replace(/-/g, '')}`,
      );
      const userCols = sqlCols.map((c) => c.column_name).filter((n) => n.startsWith('col_'));
      expect(userCols).toHaveLength(0);
    });

    it('should list columns for a table', async () => {
      await adapter.createColumn({ tableId, name: 'A', type: 'text' });
      await adapter.createColumn({ tableId, name: 'B', type: 'number' });

      const columns = await adapter.getColumns(tableId);
      expect(columns).toHaveLength(2);
      expect(columns[0].position).toBeLessThan(columns[1].position);
    });

    it('should delete a column', async () => {
      const col = await adapter.createColumn({ tableId, name: 'ToRemove', type: 'text' });
      await adapter.deleteColumn(tableId, col.id);

      const columns = await adapter.getColumns(tableId);
      expect(columns).toHaveLength(0);
    });
  });

  // =========================================================================
  // Row CRUD
  // =========================================================================

  describe('Rows', () => {
    let tableId: string;
    let nameColId: string;
    let ageColId: string;

    beforeEach(async () => {
      const table = await adapter.createTable({ workspaceId, name: 'People' });
      tableId = table.id;

      const nameCol = await adapter.createColumn({ tableId, name: 'Name', type: 'text' });
      const ageCol = await adapter.createColumn({ tableId, name: 'Age', type: 'number' });
      nameColId = nameCol.id;
      ageColId = ageCol.id;
    });

    it('should create and get a row', async () => {
      const row = await adapter.createRow({
        tableId,
        cells: { [nameColId]: 'Alice', [ageColId]: '30' },
      });

      expect(row.id).toBeTruthy();
      expect(row.cells[nameColId]).toBe('Alice');
      expect(row.cells[ageColId]).toBe('30');

      const fetched = await adapter.getRow(tableId, row.id);
      expect(fetched.cells[nameColId]).toBe('Alice');
    });

    it('should update a row', async () => {
      const row = await adapter.createRow({
        tableId,
        cells: { [nameColId]: 'Bob', [ageColId]: '25' },
      });

      const updated = await adapter.updateRow(tableId, row.id, {
        cells: { [nameColId]: 'Robert' },
      });

      expect(updated.cells[nameColId]).toBe('Robert');
      expect(updated.cells[ageColId]).toBe('25'); // unchanged
    });

    it('should delete a row', async () => {
      const row = await adapter.createRow({
        tableId,
        cells: { [nameColId]: 'Charlie' },
      });

      await adapter.deleteRow(tableId, row.id);
      await expect(adapter.getRow(tableId, row.id)).rejects.toThrow();
    });

    it('should query rows with filters', async () => {
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Alice', [ageColId]: '30' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Bob', [ageColId]: '25' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Charlie', [ageColId]: '35' } });

      const result = await adapter.getRows(tableId, {
        filters: [{ columnId: nameColId, operator: 'contains', value: 'li' }],
      });

      expect(result.rows).toHaveLength(2); // Alice and Charlie
    });

    it('should query rows with sorting', async () => {
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Charlie', [ageColId]: '35' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Alice', [ageColId]: '30' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Bob', [ageColId]: '25' } });

      const result = await adapter.getRows(tableId, {
        sort: { columnId: nameColId, direction: 'asc' },
      });

      expect(result.rows[0].cells[nameColId]).toBe('Alice');
      expect(result.rows[2].cells[nameColId]).toBe('Charlie');
    });

    it('should paginate rows', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.createRow({ tableId, cells: { [nameColId]: `Person ${i}` } });
      }

      const page1 = await adapter.getRows(tableId, { limit: 2, offset: 0 });
      expect(page1.rows).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = await adapter.getRows(tableId, { limit: 2, offset: 2 });
      expect(page2.rows).toHaveLength(2);
    });
  });

  // =========================================================================
  // Views
  // =========================================================================

  describe('Views', () => {
    let tableId: string;

    beforeEach(async () => {
      const table = await adapter.createTable({ workspaceId, name: 'View Test' });
      tableId = table.id;
    });

    it('should create and list views', async () => {
      await adapter.createView({ tableId, name: 'Grid View', type: 'table' });
      await adapter.createView({ tableId, name: 'Board View', type: 'board' });

      const views = await adapter.getViews(tableId);
      expect(views).toHaveLength(2);
    });

    it('should update a view', async () => {
      const view = await adapter.createView({ tableId, name: 'Old', type: 'table' });
      const updated = await adapter.updateView(tableId, view.id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('should delete a view', async () => {
      const view = await adapter.createView({ tableId, name: 'Delete Me', type: 'table' });
      await adapter.deleteView(tableId, view.id);
      const views = await adapter.getViews(tableId);
      expect(views).toHaveLength(0);
    });
  });
});
