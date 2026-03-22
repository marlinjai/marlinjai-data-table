/**
 * @marlinjai/data-table-adapter-d1
 *
 * Cloudflare D1 adapter for @marlinjai/data-table
 * Uses real SQL columns in per-table tables (tbl_<id>) instead of JSON blobs.
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  BaseDatabaseAdapter,
  type Table,
  type Column,
  type Row,
  type SelectOption,
  type FileReference,
  type View,
  type ViewConfig,
  type QueryOptions,
  type QueryResult,
  type CreateTableInput,
  type CreateColumnInput,
  type CreateRowInput,
  type CreateSelectOptionInput,
  type CreateRelationInput,
  type CreateFileRefInput,
  type CreateViewInput,
  type UpdateTableInput,
  type UpdateColumnInput,
  type UpdateSelectOptionInput,
  type UpdateViewInput,
  type CellValue,
  type ColumnConfig,
  type DatabaseAdapter,
} from '@marlinjai/data-table-core';
import {
  safeTableName,
  safeColumnName,
  isScalarType,
  serializeCell,
  deserializeCell,
  buildWhereClause,
  buildOrderBy,
} from '@marlinjai/data-table-adapter-shared';
import { createRealTableD1, dropRealTableD1, addColumnD1, dropColumnD1 } from './ddl-compat.js';
import { ensureRealTableD1 } from './migration.js';

// ---------------------------------------------------------------------------
// D1 raw row interfaces
// ---------------------------------------------------------------------------

interface D1Row {
  id: string;
  table_id: string;
  _archived: number;
  _created_at: string;
  _updated_at: string;
}

interface D1Table {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  migrated: number;
  created_at: string;
  updated_at: string;
}

interface D1Column {
  id: string;
  table_id: string;
  name: string;
  type: string;
  position: number;
  width: number;
  is_primary: number;
  config: string | null;
  created_at: string;
}

interface D1SelectOption {
  id: string;
  column_id: string;
  name: string;
  color: string | null;
  position: number;
}

interface D1FileReference {
  id: string;
  row_id: string;
  column_id: string;
  file_id: string;
  file_url: string;
  original_name: string;
  file_type: string;
  size_bytes: number | null;
  position: number;
  metadata: string | null;
}

interface D1Relation {
  id: string;
  source_row_id: string;
  source_column_id: string;
  target_row_id: string;
  created_at: string;
}

interface D1View {
  id: string;
  table_id: string;
  name: string;
  type: string;
  is_default: number;
  position: number;
  config: string | null;
  created_at: string;
  updated_at: string;
}

// A real-table row — id + metadata columns plus arbitrary TEXT user columns
type RealTableRow = D1Row & Record<string, string | number | null>;

export class D1Adapter extends BaseDatabaseAdapter {
  constructor(private db: D1Database) {
    super();
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Returns a Map<columnId, Column> for all columns belonging to a table.
   */
  private async getColumnMap(tableId: string): Promise<Map<string, Column>> {
    const result = await this.db
      .prepare('SELECT * FROM dt_columns WHERE table_id = ? ORDER BY position ASC')
      .bind(tableId)
      .all<D1Column>();

    const map = new Map<string, Column>();
    for (const row of result.results) {
      map.set(row.id, this.mapColumn(row));
    }
    return map;
  }

  // =========================================================================
  // Tables
  // =========================================================================

  async createTable(input: CreateTableInput): Promise<Table> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO dt_tables (id, workspace_id, name, description, icon, migrated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(id, input.workspaceId, input.name, input.description ?? null, input.icon ?? null, now, now)
      .run();

    // Create the real (empty) per-table SQL table immediately
    await createRealTableD1(this.db, id, []);

    return {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getTable(tableId: string): Promise<Table | null> {
    const result = await this.db.prepare('SELECT * FROM dt_tables WHERE id = ?').bind(tableId).first<D1Table>();

    if (!result) return null;

    return this.mapTable(result);
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description ?? null);
    }
    if (updates.icon !== undefined) {
      setClauses.push('icon = ?');
      values.push(updates.icon ?? null);
    }

    values.push(tableId);

    await this.db.prepare(`UPDATE dt_tables SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();

    const table = await this.getTable(tableId);
    if (!table) throw new Error('Table not found after update');
    return table;
  }

  async deleteTable(tableId: string): Promise<void> {
    // Drop real table first, then cascade-delete metadata
    await dropRealTableD1(this.db, tableId);

    await this.db.batch([
      this.db.prepare('DELETE FROM dt_files WHERE row_id IN (SELECT id FROM dt_rows WHERE table_id = ?)').bind(tableId),
      this.db.prepare('DELETE FROM dt_relations WHERE source_row_id IN (SELECT id FROM dt_rows WHERE table_id = ?)').bind(tableId),
      this.db.prepare('DELETE FROM dt_rows WHERE table_id = ?').bind(tableId),
      this.db.prepare('DELETE FROM dt_select_options WHERE column_id IN (SELECT id FROM dt_columns WHERE table_id = ?)').bind(tableId),
      this.db.prepare('DELETE FROM dt_columns WHERE table_id = ?').bind(tableId),
      this.db.prepare('DELETE FROM dt_views WHERE table_id = ?').bind(tableId),
      this.db.prepare('DELETE FROM dt_tables WHERE id = ?').bind(tableId),
    ]);
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    const result = await this.db
      .prepare('SELECT * FROM dt_tables WHERE workspace_id = ? ORDER BY created_at DESC')
      .bind(workspaceId)
      .all<D1Table>();

    return result.results.map((row) => this.mapTable(row));
  }

  // =========================================================================
  // Columns
  // =========================================================================

  async createColumn(input: CreateColumnInput): Promise<Column> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Get next position if not specified
    let position = input.position;
    if (position === undefined) {
      const maxResult = await this.db
        .prepare('SELECT MAX(position) as max_pos FROM dt_columns WHERE table_id = ?')
        .bind(input.tableId)
        .first<{ max_pos: number | null }>();
      position = (maxResult?.max_pos ?? -1) + 1;
    }

    await this.db
      .prepare(
        `INSERT INTO dt_columns (id, table_id, name, type, position, width, is_primary, config, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.tableId,
        input.name,
        input.type,
        position,
        input.width ?? 200,
        input.isPrimary ? 1 : 0,
        input.config ? JSON.stringify(input.config) : null,
        now
      )
      .run();

    // Add a real SQL column for scalar types
    if (isScalarType(input.type)) {
      await addColumnD1(this.db, input.tableId, id);
    }

    return {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      position,
      width: input.width ?? 200,
      isPrimary: input.isPrimary ?? false,
      config: input.config,
      createdAt: new Date(now),
    };
  }

  async getColumns(tableId: string): Promise<Column[]> {
    const result = await this.db
      .prepare('SELECT * FROM dt_columns WHERE table_id = ? ORDER BY position ASC')
      .bind(tableId)
      .all<D1Column>();

    return result.results.map((row) => this.mapColumn(row));
  }

  async getColumn(columnId: string): Promise<Column | null> {
    const result = await this.db.prepare('SELECT * FROM dt_columns WHERE id = ?').bind(columnId).first<D1Column>();

    if (!result) return null;
    return this.mapColumn(result);
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.width !== undefined) {
      setClauses.push('width = ?');
      values.push(updates.width);
    }
    if (updates.config !== undefined) {
      setClauses.push('config = ?');
      values.push(updates.config ? JSON.stringify(updates.config) : null);
    }

    if (setClauses.length > 0) {
      values.push(columnId);
      await this.db.prepare(`UPDATE dt_columns SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
    }

    const column = await this.getColumn(columnId);
    if (!column) throw new Error('Column not found after update');
    return column;
  }

  async deleteColumn(columnId: string): Promise<void> {
    // Fetch column metadata so we know type + tableId before deleting
    const column = await this.getColumn(columnId);

    if (column && isScalarType(column.type)) {
      await dropColumnD1(this.db, column.tableId, columnId);
    }

    await this.db.batch([
      this.db.prepare('DELETE FROM dt_select_options WHERE column_id = ?').bind(columnId),
      this.db.prepare('DELETE FROM dt_files WHERE column_id = ?').bind(columnId),
      this.db.prepare('DELETE FROM dt_relations WHERE source_column_id = ?').bind(columnId),
      this.db.prepare('DELETE FROM dt_columns WHERE id = ?').bind(columnId),
    ]);
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    const statements = columnIds.map((id, index) =>
      this.db.prepare('UPDATE dt_columns SET position = ? WHERE id = ? AND table_id = ?').bind(index, id, tableId)
    );
    await this.db.batch(statements);
  }

  // =========================================================================
  // Select Options
  // =========================================================================

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    const id = this.generateId();

    let position = input.position;
    if (position === undefined) {
      const maxResult = await this.db
        .prepare('SELECT MAX(position) as max_pos FROM dt_select_options WHERE column_id = ?')
        .bind(input.columnId)
        .first<{ max_pos: number | null }>();
      position = (maxResult?.max_pos ?? -1) + 1;
    }

    await this.db
      .prepare('INSERT INTO dt_select_options (id, column_id, name, color, position) VALUES (?, ?, ?, ?, ?)')
      .bind(id, input.columnId, input.name, input.color ?? null, position)
      .run();

    return {
      id,
      columnId: input.columnId,
      name: input.name,
      color: input.color,
      position,
    };
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    const result = await this.db
      .prepare('SELECT * FROM dt_select_options WHERE column_id = ? ORDER BY position ASC')
      .bind(columnId)
      .all<D1SelectOption>();

    return result.results.map((row) => ({
      id: row.id,
      columnId: row.column_id,
      name: row.name,
      color: row.color ?? undefined,
      position: row.position,
    }));
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push('color = ?');
      values.push(updates.color ?? null);
    }
    if (updates.position !== undefined) {
      setClauses.push('position = ?');
      values.push(updates.position);
    }

    if (setClauses.length > 0) {
      values.push(optionId);
      await this.db.prepare(`UPDATE dt_select_options SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
    }

    const result = await this.db.prepare('SELECT * FROM dt_select_options WHERE id = ?').bind(optionId).first<D1SelectOption>();

    if (!result) throw new Error('Select option not found');

    return {
      id: result.id,
      columnId: result.column_id,
      name: result.name,
      color: result.color ?? undefined,
      position: result.position,
    };
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    await this.db.prepare('DELETE FROM dt_select_options WHERE id = ?').bind(optionId).run();
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    const statements = optionIds.map((id, index) =>
      this.db.prepare('UPDATE dt_select_options SET position = ? WHERE id = ? AND column_id = ?').bind(index, id, columnId)
    );
    await this.db.batch(statements);
  }

  // =========================================================================
  // Rows
  // =========================================================================

  async createRow(input: CreateRowInput): Promise<Row> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const cells = input.cells ?? {};

    // Ensure real table exists (lazy migrate legacy tables)
    await ensureRealTableD1(this.db, input.tableId);

    const columnsMap = await this.getColumnMap(input.tableId);
    const tableName = safeTableName(input.tableId);

    // Build column list and values for the real table INSERT
    const colNames: string[] = ['id', '_archived', '_created_at', '_updated_at'];
    const placeholders: string[] = ['?', '?', '?', '?'];
    const values: (string | number | null)[] = [id, 0, now, now];

    for (const [colId, column] of columnsMap) {
      if (!isScalarType(column.type)) continue;
      colNames.push(safeColumnName(colId));
      placeholders.push('?');
      values.push(serializeCell(cells[colId] ?? null, column.type));
    }

    // Insert into real table
    await this.db
      .prepare(`INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`)
      .bind(...values)
      .run();

    // Keep dt_rows as metadata/index (no cells column)
    await this.db
      .prepare(
        `INSERT INTO dt_rows (id, table_id, _archived, _created_at, _updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, input.tableId, 0, now, now)
      .run();

    return {
      id,
      tableId: input.tableId,
      cells,
      computed: {},
      archived: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getRow(rowId: string): Promise<Row | null> {
    // Look up the tableId from the dt_rows index
    const meta = await this.db
      .prepare('SELECT id, table_id, _archived, _created_at, _updated_at FROM dt_rows WHERE id = ?')
      .bind(rowId)
      .first<D1Row>();

    if (!meta) return null;

    const tableId = meta.table_id;
    await ensureRealTableD1(this.db, tableId);

    const tableName = safeTableName(tableId);
    const realRow = await this.db
      .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
      .bind(rowId)
      .first<RealTableRow>();

    if (!realRow) return null;

    const columnsMap = await this.getColumnMap(tableId);
    const cells = this.extractCells(realRow, columnsMap);

    return {
      id: realRow.id,
      tableId,
      cells,
      computed: {},
      archived: realRow._archived === 1,
      createdAt: new Date(realRow._created_at),
      updatedAt: new Date(realRow._updated_at),
    };
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    await ensureRealTableD1(this.db, tableId);

    const columnsMap = await this.getColumnMap(tableId);
    const tableName = safeTableName(tableId);

    // Base conditions
    const baseConditions: string[] = [];
    const baseParams: unknown[] = [];

    if (!query?.includeArchived) {
      baseConditions.push('_archived = 0');
    }

    // Filter clause from adapter-shared
    let filterClause = '';
    let filterParams: unknown[] = [];
    if (query?.filters && query.filters.length > 0) {
      const result = buildWhereClause(query.filters, columnsMap, 'sqlite', 1);
      filterClause = result.clause !== '1=1' ? result.clause : '';
      filterParams = result.params;
    }

    const allConditions = [
      ...baseConditions,
      ...(filterClause ? [filterClause] : []),
    ];
    const whereClause = allConditions.length > 0 ? `WHERE ${allConditions.join(' AND ')}` : '';
    const allParams = [...baseParams, ...filterParams];

    // ORDER BY
    const orderBy = buildOrderBy(query?.sorts ?? [], columnsMap, 'sqlite');

    // Count
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`)
      .bind(...allParams)
      .first<{ count: number }>();
    const total = countResult?.count ?? 0;

    // Pagination
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;

    const rows = await this.db
      .prepare(`SELECT * FROM ${tableName} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...allParams, limit, offset)
      .all<RealTableRow>();

    const items = rows.results.map((row) => ({
      id: row.id,
      tableId,
      cells: this.extractCells(row, columnsMap),
      computed: {},
      archived: row._archived === 1,
      createdAt: new Date(row._created_at),
      updatedAt: new Date(row._updated_at),
    }));

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      cursor: offset + items.length < total ? String(offset + limit) : undefined,
    };
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    const now = new Date().toISOString();

    // Get metadata row to find tableId
    const meta = await this.db
      .prepare('SELECT id, table_id, _archived, _created_at, _updated_at FROM dt_rows WHERE id = ?')
      .bind(rowId)
      .first<D1Row>();
    if (!meta) throw new Error('Row not found');

    const tableId = meta.table_id;
    await ensureRealTableD1(this.db, tableId);

    const columnsMap = await this.getColumnMap(tableId);
    const tableName = safeTableName(tableId);

    // Build SET clause for scalar columns present in the cells update
    const setClauses: string[] = ['_updated_at = ?'];
    const setValues: (string | number | null)[] = [now];

    for (const [colId, column] of columnsMap) {
      if (!isScalarType(column.type)) continue;
      if (!(colId in cells)) continue;
      setClauses.push(`${safeColumnName(colId)} = ?`);
      setValues.push(serializeCell(cells[colId], column.type));
    }

    // Update real table
    await this.db
      .prepare(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...setValues, rowId)
      .run();

    // Update dt_rows metadata timestamp
    await this.db
      .prepare('UPDATE dt_rows SET _updated_at = ? WHERE id = ?')
      .bind(now, rowId)
      .run();

    // Re-read the full row to return accurate merged state
    const updated = await this.getRow(rowId);
    if (!updated) throw new Error('Row not found after update');
    return updated;
  }

  async deleteRow(rowId: string): Promise<void> {
    // We need tableId to delete from real table
    const meta = await this.db
      .prepare('SELECT table_id FROM dt_rows WHERE id = ?')
      .bind(rowId)
      .first<{ table_id: string }>();

    if (meta) {
      const tableName = safeTableName(meta.table_id);
      await this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(rowId).run();
    }

    await this.db.batch([
      this.db.prepare('DELETE FROM dt_files WHERE row_id = ?').bind(rowId),
      this.db.prepare('DELETE FROM dt_relations WHERE source_row_id = ? OR target_row_id = ?').bind(rowId, rowId),
      this.db.prepare('DELETE FROM dt_rows WHERE id = ?').bind(rowId),
    ]);
  }

  async archiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();

    const meta = await this.db
      .prepare('SELECT table_id FROM dt_rows WHERE id = ?')
      .bind(rowId)
      .first<{ table_id: string }>();

    if (meta) {
      const tableName = safeTableName(meta.table_id);
      await this.db
        .prepare(`UPDATE ${tableName} SET _archived = 1, _updated_at = ? WHERE id = ?`)
        .bind(now, rowId)
        .run();
    }

    await this.db
      .prepare('UPDATE dt_rows SET _archived = 1, _updated_at = ? WHERE id = ?')
      .bind(now, rowId)
      .run();
  }

  async unarchiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();

    const meta = await this.db
      .prepare('SELECT table_id FROM dt_rows WHERE id = ?')
      .bind(rowId)
      .first<{ table_id: string }>();

    if (meta) {
      const tableName = safeTableName(meta.table_id);
      await this.db
        .prepare(`UPDATE ${tableName} SET _archived = 0, _updated_at = ? WHERE id = ?`)
        .bind(now, rowId)
        .run();
    }

    await this.db
      .prepare('UPDATE dt_rows SET _archived = 0, _updated_at = ? WHERE id = ?')
      .bind(now, rowId)
      .run();
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    if (inputs.length === 0) return [];

    const now = new Date().toISOString();
    const rows: Row[] = [];

    // Group inputs by tableId so we can batch per table
    const byTable = new Map<string, Array<{ input: CreateRowInput; id: string }>>();
    for (const input of inputs) {
      const id = this.generateId();
      if (!byTable.has(input.tableId)) byTable.set(input.tableId, []);
      byTable.get(input.tableId)!.push({ input, id });
      rows.push({
        id,
        tableId: input.tableId,
        cells: input.cells ?? {},
        computed: {},
        archived: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }

    for (const [tableId, entries] of byTable) {
      await ensureRealTableD1(this.db, tableId);
      const columnsMap = await this.getColumnMap(tableId);
      const tableName = safeTableName(tableId);

      const realInserts = entries.map(({ input, id }) => {
        const cells = input.cells ?? {};
        const colNames: string[] = ['id', '_archived', '_created_at', '_updated_at'];
        const placeholders: string[] = ['?', '?', '?', '?'];
        const values: (string | number | null)[] = [id, 0, now, now];

        for (const [colId, column] of columnsMap) {
          if (!isScalarType(column.type)) continue;
          colNames.push(safeColumnName(colId));
          placeholders.push('?');
          values.push(serializeCell(cells[colId] ?? null, column.type));
        }

        return this.db
          .prepare(`INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`)
          .bind(...values);
      });

      const metaInserts = entries.map(({ input, id }) =>
        this.db
          .prepare(
            `INSERT INTO dt_rows (id, table_id, _archived, _created_at, _updated_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(id, input.tableId, 0, now, now)
      );

      await this.db.batch([...realInserts, ...metaInserts]);
    }

    return rows;
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;

    // Look up tableIds for all rows
    const placeholders = rowIds.map(() => '?').join(', ');
    const metas = await this.db
      .prepare(`SELECT id, table_id FROM dt_rows WHERE id IN (${placeholders})`)
      .bind(...rowIds)
      .all<{ id: string; table_id: string }>();

    // Group by table
    const byTable = new Map<string, string[]>();
    for (const meta of metas.results) {
      if (!byTable.has(meta.table_id)) byTable.set(meta.table_id, []);
      byTable.get(meta.table_id)!.push(meta.id);
    }

    // Delete from real tables
    for (const [tableId, ids] of byTable) {
      const tableName = safeTableName(tableId);
      const ph = ids.map(() => '?').join(', ');
      await this.db.prepare(`DELETE FROM ${tableName} WHERE id IN (${ph})`).bind(...ids).run();
    }

    // Delete metadata
    await this.db.batch([
      this.db.prepare(`DELETE FROM dt_files WHERE row_id IN (${placeholders})`).bind(...rowIds),
      this.db.prepare(`DELETE FROM dt_relations WHERE source_row_id IN (${placeholders}) OR target_row_id IN (${placeholders})`).bind(...rowIds, ...rowIds),
      this.db.prepare(`DELETE FROM dt_rows WHERE id IN (${placeholders})`).bind(...rowIds),
    ]);
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;

    const now = new Date().toISOString();
    const placeholders = rowIds.map(() => '?').join(', ');

    // Look up tableIds
    const metas = await this.db
      .prepare(`SELECT id, table_id FROM dt_rows WHERE id IN (${placeholders})`)
      .bind(...rowIds)
      .all<{ id: string; table_id: string }>();

    const byTable = new Map<string, string[]>();
    for (const meta of metas.results) {
      if (!byTable.has(meta.table_id)) byTable.set(meta.table_id, []);
      byTable.get(meta.table_id)!.push(meta.id);
    }

    // Archive in real tables
    for (const [tableId, ids] of byTable) {
      const tableName = safeTableName(tableId);
      const ph = ids.map(() => '?').join(', ');
      await this.db
        .prepare(`UPDATE ${tableName} SET _archived = 1, _updated_at = ? WHERE id IN (${ph})`)
        .bind(now, ...ids)
        .run();
    }

    // Update dt_rows metadata
    await this.db
      .prepare(`UPDATE dt_rows SET _archived = 1, _updated_at = ? WHERE id IN (${placeholders})`)
      .bind(now, ...rowIds)
      .run();
  }

  // =========================================================================
  // Relations
  // =========================================================================

  async createRelation(input: CreateRelationInput): Promise<void> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO dt_relations (id, source_row_id, source_column_id, target_row_id, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (source_row_id, source_column_id, target_row_id) DO NOTHING`
      )
      .bind(id, input.sourceRowId, input.sourceColumnId, input.targetRowId, now)
      .run();
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM dt_relations WHERE source_row_id = ? AND source_column_id = ? AND target_row_id = ?')
      .bind(sourceRowId, columnId, targetRowId)
      .run();
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    const relations = await this.db
      .prepare('SELECT target_row_id FROM dt_relations WHERE source_row_id = ? AND source_column_id = ?')
      .bind(rowId, columnId)
      .all<{ target_row_id: string }>();

    if (relations.results.length === 0) return [];

    const targetIds = relations.results.map((r) => r.target_row_id);
    return Promise.all(targetIds.map((id) => this.getRow(id))).then(
      (results) => results.filter((r): r is Row => r !== null)
    );
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    const result = await this.db
      .prepare('SELECT source_column_id, target_row_id FROM dt_relations WHERE source_row_id = ?')
      .bind(rowId)
      .all<{ source_column_id: string; target_row_id: string }>();

    return result.results.map((r) => ({
      columnId: r.source_column_id,
      targetRowId: r.target_row_id,
    }));
  }

  // =========================================================================
  // File References
  // =========================================================================

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    const id = this.generateId();

    let position = input.position;
    if (position === undefined) {
      const maxResult = await this.db
        .prepare('SELECT MAX(position) as max_pos FROM dt_files WHERE row_id = ? AND column_id = ?')
        .bind(input.rowId, input.columnId)
        .first<{ max_pos: number | null }>();
      position = (maxResult?.max_pos ?? -1) + 1;
    }

    await this.db
      .prepare(
        `INSERT INTO dt_files (id, row_id, column_id, file_id, file_url, original_name, file_type, size_bytes, position, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.rowId,
        input.columnId,
        input.fileId,
        input.fileUrl,
        input.originalName,
        input.mimeType,
        input.sizeBytes ?? null,
        position,
        input.metadata ? JSON.stringify(input.metadata) : null
      )
      .run();

    return {
      id,
      rowId: input.rowId,
      columnId: input.columnId,
      fileId: input.fileId,
      fileUrl: input.fileUrl,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      position,
      metadata: input.metadata,
    };
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    await this.db.prepare('DELETE FROM dt_files WHERE id = ?').bind(fileRefId).run();
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    const result = await this.db
      .prepare('SELECT * FROM dt_files WHERE row_id = ? AND column_id = ? ORDER BY position ASC')
      .bind(rowId, columnId)
      .all<D1FileReference>();

    return result.results.map((row) => ({
      id: row.id,
      rowId: row.row_id,
      columnId: row.column_id,
      fileId: row.file_id,
      fileUrl: row.file_url,
      originalName: row.original_name,
      mimeType: row.file_type,
      sizeBytes: row.size_bytes ?? undefined,
      position: row.position,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    const statements = fileRefIds.map((id, index) =>
      this.db.prepare('UPDATE dt_files SET position = ? WHERE id = ? AND row_id = ? AND column_id = ?').bind(index, id, rowId, columnId)
    );
    await this.db.batch(statements);
  }

  // =========================================================================
  // Views
  // =========================================================================

  async createView(input: CreateViewInput): Promise<View> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Get next position if not specified
    let position = input.position;
    if (position === undefined) {
      const maxResult = await this.db
        .prepare('SELECT MAX(position) as max_pos FROM dt_views WHERE table_id = ?')
        .bind(input.tableId)
        .first<{ max_pos: number | null }>();
      position = (maxResult?.max_pos ?? -1) + 1;
    }

    // Check if this is the first view for the table
    const countResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM dt_views WHERE table_id = ?')
      .bind(input.tableId)
      .first<{ count: number }>();
    const isFirstView = (countResult?.count ?? 0) === 0;
    const isDefault = input.isDefault ?? isFirstView;

    // If this view is default, unset default on other views
    if (isDefault) {
      await this.db
        .prepare('UPDATE dt_views SET is_default = 0, updated_at = ? WHERE table_id = ? AND is_default = 1')
        .bind(now, input.tableId)
        .run();
    }

    await this.db
      .prepare(
        `INSERT INTO dt_views (id, table_id, name, type, is_default, position, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.tableId,
        input.name,
        input.type,
        isDefault ? 1 : 0,
        position,
        input.config ? JSON.stringify(input.config) : null,
        now,
        now
      )
      .run();

    return {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      isDefault,
      position,
      config: input.config ?? {},
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getViews(tableId: string): Promise<View[]> {
    const result = await this.db
      .prepare('SELECT * FROM dt_views WHERE table_id = ? ORDER BY position ASC')
      .bind(tableId)
      .all<D1View>();

    return result.results.map((row) => this.mapView(row));
  }

  async getView(viewId: string): Promise<View | null> {
    const result = await this.db
      .prepare('SELECT * FROM dt_views WHERE id = ?')
      .bind(viewId)
      .first<D1View>();

    if (!result) return null;
    return this.mapView(result);
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    // Get existing view to know the tableId
    const existing = await this.getView(viewId);
    if (!existing) throw new Error('View not found');

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      values.push(updates.type);
    }
    if (updates.isDefault !== undefined) {
      setClauses.push('is_default = ?');
      values.push(updates.isDefault ? 1 : 0);

      // If setting as default, unset other views
      if (updates.isDefault) {
        await this.db
          .prepare('UPDATE dt_views SET is_default = 0, updated_at = ? WHERE table_id = ? AND id != ?')
          .bind(now, existing.tableId, viewId)
          .run();
      }
    }
    if (updates.config !== undefined) {
      setClauses.push('config = ?');
      values.push(updates.config ? JSON.stringify({ ...existing.config, ...updates.config }) : null);
    }

    values.push(viewId);

    await this.db
      .prepare(`UPDATE dt_views SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const view = await this.getView(viewId);
    if (!view) throw new Error('View not found after update');
    return view;
  }

  async deleteView(viewId: string): Promise<void> {
    // Get the view to check if it's default
    const view = await this.getView(viewId);
    if (!view) return;

    await this.db.prepare('DELETE FROM dt_views WHERE id = ?').bind(viewId).run();

    // If deleted view was default, make another view default
    if (view.isDefault) {
      const now = new Date().toISOString();
      await this.db
        .prepare(
          `UPDATE dt_views SET is_default = 1, updated_at = ?
           WHERE table_id = ? AND id = (SELECT id FROM dt_views WHERE table_id = ? ORDER BY position ASC LIMIT 1)`
        )
        .bind(now, view.tableId, view.tableId)
        .run();
    }
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    const statements = viewIds.map((id, index) =>
      this.db.prepare('UPDATE dt_views SET position = ? WHERE id = ? AND table_id = ?').bind(index, id, tableId)
    );
    await this.db.batch(statements);
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // D1 doesn't support true transactions in the same way as traditional databases
    // We use batch for atomic operations where possible
    // For complex transactions, we just run the function directly
    return fn(this);
  }

  // =========================================================================
  // Mappers
  // =========================================================================

  private mapTable(row: D1Table): Table {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description ?? undefined,
      icon: row.icon ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapColumn(row: D1Column): Column {
    return {
      id: row.id,
      tableId: row.table_id,
      name: row.name,
      type: row.type as Column['type'],
      position: row.position,
      width: row.width,
      isPrimary: row.is_primary === 1,
      config: row.config ? (JSON.parse(row.config) as ColumnConfig) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private mapView(row: D1View): View {
    return {
      id: row.id,
      tableId: row.table_id,
      name: row.name,
      type: row.type as View['type'],
      isDefault: row.is_default === 1,
      position: row.position,
      config: row.config ? (JSON.parse(row.config) as ViewConfig) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Extract cell values from a real-table row using the column map.
   * Deserializes TEXT storage back to typed JS values.
   */
  private extractCells(row: RealTableRow, columnsMap: Map<string, Column>): Record<string, CellValue> {
    const cells: Record<string, CellValue> = {};
    for (const [colId, column] of columnsMap) {
      if (!isScalarType(column.type)) continue;
      const colName = safeColumnName(colId);
      const raw = row[colName];
      cells[colId] = deserializeCell(raw != null ? String(raw) : null, column.type);
    }
    return cells;
  }
}

// Re-export types for convenience
export type { DatabaseAdapter } from '@marlinjai/data-table-core';
