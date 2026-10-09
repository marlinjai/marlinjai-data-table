/**
 * Integration tests for PrismaAdapter.
 *
 * Requires a running PostgreSQL instance. Set TEST_DATABASE_URL to a disposable local database ending in _test.
 * Tests are skipped when no database is available.
 *
 * Run with TEST_DATABASE_URL pointing at the isolated test database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRealTable } from '../ddl.js';
import { safeTableName } from '@marlinjai/data-table-adapter-shared';
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from '../adapter.js';
import type { Table, Column, Row } from '@marlinjai/data-table-core';

const DATABASE_URL = process.env.TEST_DATABASE_URL;
if (DATABASE_URL) {
  const target = new URL(DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(target.hostname)
    || !target.pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must point to a disposable local database ending in _test');
  }
}

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

    // Use `pnpm test:db` for initial schema setup. Keeping schema creation
    // outside a test hook makes cold CLI startup independent of test timeouts.
    await prisma.dtTable.count();

    adapter = new PrismaAdapter({ prisma });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
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
      expect(fetched?.name).toBe('My Table');
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
      expect(await adapter.getTable(table.id)).toBeNull();

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

    it('serializes competing column creates and leaves exactly one physical column', async () => {
      const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () =>
        adapter.createColumn({ tableId, name: 'Concurrent', type: 'text' })));
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(failures).toHaveLength(4);
      for (const failure of failures) expect(failure.reason.message).toMatch(/already exists/);
      expect(await adapter.getColumns(tableId)).toHaveLength(1);
      const fields = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name LIKE 'col_%'",
        safeTableName(tableId),
      );
      expect(fields).toHaveLength(1);
    });

    it('rejects competing renames but allows the same name in another table', async () => {
      const first = await adapter.createColumn({ tableId, name: 'First', type: 'text' });
      const second = await adapter.createColumn({ tableId, name: 'Second', type: 'text' });
      const outcomes = await Promise.allSettled([
        adapter.updateColumn(first.id, { name: 'Shared' }),
        adapter.updateColumn(second.id, { name: 'Shared' }),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect((await adapter.getColumns(tableId)).filter((column) => column.name === 'Shared')).toHaveLength(1);
      const other = await adapter.createTable({ workspaceId, name: 'Other' });
      await expect(adapter.createColumn({ tableId: other.id, name: 'Shared', type: 'text' })).resolves.toMatchObject({ name: 'Shared' });
    });

    it('rolls back metadata when physical creation fails, and accepts a retry', async () => {
      await prisma.$executeRawUnsafe(`DROP TABLE ${safeTableName(tableId)}`);
      await expect(adapter.createColumn({ tableId, name: 'Retry', type: 'text' })).rejects.toThrow();
      expect(await adapter.getColumns(tableId)).toHaveLength(0);
      await createRealTable(prisma, tableId, []);
      await expect(adapter.createColumn({ tableId, name: 'Retry', type: 'text' })).resolves.toMatchObject({ name: 'Retry' });
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
      await adapter.deleteColumn(col.id);

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

      const fetched = await adapter.getRow(row.id);
      expect(fetched?.cells[nameColId]).toBe('Alice');
    });

    it('should update a row', async () => {
      const row = await adapter.createRow({
        tableId,
        cells: { [nameColId]: 'Bob', [ageColId]: '25' },
      });

      const updated = await adapter.updateRow(row.id, { [nameColId]: 'Robert' });

      expect(updated.cells[nameColId]).toBe('Robert');
      expect(updated.cells[ageColId]).toBe(25); // unchanged
    });

    it('should delete a row', async () => {
      const row = await adapter.createRow({
        tableId,
        cells: { [nameColId]: 'Charlie' },
      });

      await adapter.deleteRow(row.id);
      expect(await adapter.getRow(row.id)).toBeNull();
    });

    it('reads the same row across schema edits and reloads without disabling statement caching', async () => {
      const row = await adapter.createRow({ tableId, cells: { [nameColId]: 'Original' } });
      expect((await adapter.getRow(row.id))?.cells[nameColId]).toBe('Original');
      expect((await adapter.getRows(tableId)).items).toHaveLength(1);
      const added = await adapter.createColumn({ tableId, name: 'Added', type: 'text' });
      await adapter.updateRow(row.id, { [added.id]: 'Saved' });
      expect((await adapter.getRows(tableId)).items[0].cells[added.id]).toBe('Saved');
      const reloadedClient = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
      try {
        const reloaded = new PrismaAdapter({ prisma: reloadedClient });
        expect((await reloaded.getRow(row.id))?.cells[added.id]).toBe('Saved');
      } finally {
        await reloadedClient.$disconnect();
      }
      await adapter.deleteColumn(added.id);
      expect((await adapter.getRow(row.id))?.cells[nameColId]).toBe('Original');
      expect((await adapter.getRows(tableId)).items[0].cells).not.toHaveProperty(added.id);
      const replacement = await adapter.createColumn({ tableId, name: 'Added', type: 'text' });
      expect((await adapter.getRow(row.id))?.cells[replacement.id]).toBeNull();
    });

    it('propagates database failures instead of reporting a missing row', async () => {
      const row = await adapter.createRow({ tableId, cells: { [nameColId]: 'Present' } });
      await prisma.$executeRawUnsafe(`DROP TABLE ${safeTableName(tableId)}`);
      await expect(adapter.getRow(row.id)).rejects.toThrow();
    });

    it('rejects unknown writes before changing valid cells or selections', async () => {
      const tags = await adapter.createColumn({ tableId, name: 'Tags', type: 'multi_select' });
      const option = await adapter.createSelectOption({ columnId: tags.id, name: 'Kept' });
      const row = await adapter.createRow({ tableId, cells: { [nameColId]: 'Original', [tags.id]: [option.id] } });
      await expect(adapter.updateRow(row.id, {
        [nameColId]: 'Changed', [tags.id]: [], unknown: 'Must fail',
      })).rejects.toThrow(/Unknown column/);
      const saved = await adapter.getRow(row.id);
      expect(saved?.cells[nameColId]).toBe('Original');
      expect(saved?.cells[tags.id]).toEqual([option.id]);
      await expect(adapter.updateRow(row.id, { [nameColId]: 'Retry' })).resolves.toMatchObject({ cells: { [nameColId]: 'Retry' } });
    });

    it('rejects unknown and foreign column keys before creating a row', async () => {
      const foreign = await adapter.createTable({ workspaceId, name: 'Foreign' });
      const foreignColumn = await adapter.createColumn({ tableId: foreign.id, name: 'Foreign', type: 'text' });
      await expect(adapter.createRow({ tableId, cells: { [nameColId]: 'Lost', [foreignColumn.id]: 'Foreign' } })).rejects.toThrow(/Unknown column/);
      expect((await adapter.getRows(tableId)).total).toBe(0);
      await expect(adapter.createRow({ tableId, cells: { [nameColId]: 'Retry' } })).resolves.toBeDefined();
    });

    it('should query rows with filters', async () => {
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Alice', [ageColId]: '30' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Bob', [ageColId]: '25' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Charlie', [ageColId]: '35' } });

      const result = await adapter.getRows(tableId, {
        filters: [{ columnId: nameColId, operator: 'contains', value: 'li' }],
      });

      expect(result.items).toHaveLength(2); // Alice and Charlie
    });

    it('should query rows with sorting', async () => {
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Charlie', [ageColId]: '35' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Alice', [ageColId]: '30' } });
      await adapter.createRow({ tableId, cells: { [nameColId]: 'Bob', [ageColId]: '25' } });

      const result = await adapter.getRows(tableId, {
        sorts: [{ columnId: nameColId, direction: 'asc' }],
      });

      expect(result.items[0].cells[nameColId]).toBe('Alice');
      expect(result.items[2].cells[nameColId]).toBe('Charlie');
    });

    it('should paginate rows', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.createRow({ tableId, cells: { [nameColId]: `Person ${i}` } });
      }

      const page1 = await adapter.getRows(tableId, { limit: 2, offset: 0 });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = await adapter.getRows(tableId, { limit: 2, offset: 2 });
      expect(page2.items).toHaveLength(2);
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
      const updated = await adapter.updateView(view.id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('should delete a view', async () => {
      const view = await adapter.createView({ tableId, name: 'Delete Me', type: 'table' });
      await adapter.deleteView(view.id);
      const views = await adapter.getViews(tableId);
      expect(views).toHaveLength(0);
    });
  });
});
