/**
 * @marlinjai/data-table-adapter-d1
 *
 * Cloudflare D1 adapter for @marlinjai/data-table
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

interface D1Row {
  id: string;
  table_id: string;
  cells: string;
  computed: string | null;
  _title: string | null;
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

export class D1Adapter extends BaseDatabaseAdapter {
  constructor(private db: D1Database) {
    super();
  }

  // =========================================================================
  // Tables
  // =========================================================================

  async createTable(input: CreateTableInput): Promise<Table> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO dt_tables (id, workspace_id, name, description, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, input.workspaceId, input.name, input.description ?? null, input.icon ?? null, now, now)
      .run();

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
    // Cascade delete is handled by foreign keys, but we delete explicitly for clarity
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

    await this.db
      .prepare(
        `INSERT INTO dt_rows (id, table_id, cells, computed, _title, _archived, _created_at, _updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, input.tableId, JSON.stringify(cells), null, null, 0, now, now)
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
    const result = await this.db.prepare('SELECT * FROM dt_rows WHERE id = ?').bind(rowId).first<D1Row>();

    if (!result) return null;
    return this.mapRow(result);
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    let sql = 'SELECT * FROM dt_rows WHERE table_id = ?';
    const params: (string | number | boolean)[] = [tableId];

    // Handle archived filter
    if (!query?.includeArchived) {
      sql += ' AND _archived = 0';
    }

    // Handle filters
    if (query?.filters && query.filters.length > 0) {
      for (const filter of query.filters) {
        const { columnId, operator, value } = filter;
        // For JSON cell values, we use json_extract
        const jsonPath = `json_extract(cells, '$.${columnId}')`;

        switch (operator) {
          case 'equals':
            sql += ` AND ${jsonPath} = ?`;
            params.push(value as string | number);
            break;
          case 'notEquals':
            sql += ` AND ${jsonPath} != ?`;
            params.push(value as string | number);
            break;
          case 'contains':
            sql += ` AND ${jsonPath} LIKE ?`;
            params.push(`%${value}%`);
            break;
          case 'isEmpty':
            sql += ` AND (${jsonPath} IS NULL OR ${jsonPath} = '')`;
            break;
          case 'isNotEmpty':
            sql += ` AND ${jsonPath} IS NOT NULL AND ${jsonPath} != ''`;
            break;
          case 'greaterThan':
            sql += ` AND CAST(${jsonPath} AS REAL) > ?`;
            params.push(value as number);
            break;
          case 'lessThan':
            sql += ` AND CAST(${jsonPath} AS REAL) < ?`;
            params.push(value as number);
            break;
          // Add more operators as needed
        }
      }
    }

    // Handle sorting
    if (query?.sorts && query.sorts.length > 0) {
      const sortClauses = query.sorts.map((sort) => {
        const jsonPath = `json_extract(cells, '$.${sort.columnId}')`;
        return `${jsonPath} ${sort.direction.toUpperCase()}`;
      });
      sql += ` ORDER BY ${sortClauses.join(', ')}`;
    } else {
      sql += ' ORDER BY _created_at DESC';
    }

    // Get total count
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as count FROM dt_rows WHERE table_id = ?${!query?.includeArchived ? ' AND _archived = 0' : ''}`)
      .bind(tableId)
      .first<{ count: number }>();
    const total = countResult?.count ?? 0;

    // Handle pagination
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await this.db.prepare(sql).bind(...params).all<D1Row>();

    return {
      items: result.results.map((row) => this.mapRow(row)),
      total,
      hasMore: offset + result.results.length < total,
      cursor: offset + result.results.length < total ? String(offset + limit) : undefined,
    };
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    const now = new Date().toISOString();

    // Get existing row
    const existing = await this.getRow(rowId);
    if (!existing) throw new Error('Row not found');

    // Merge cells
    const mergedCells = { ...existing.cells, ...cells };

    await this.db
      .prepare('UPDATE dt_rows SET cells = ?, _updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(mergedCells), now, rowId)
      .run();

    return {
      ...existing,
      cells: mergedCells,
      updatedAt: new Date(now),
    };
  }

  async deleteRow(rowId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM dt_files WHERE row_id = ?').bind(rowId),
      this.db.prepare('DELETE FROM dt_relations WHERE source_row_id = ? OR target_row_id = ?').bind(rowId, rowId),
      this.db.prepare('DELETE FROM dt_rows WHERE id = ?').bind(rowId),
    ]);
  }

  async archiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare('UPDATE dt_rows SET _archived = 1, _updated_at = ? WHERE id = ?').bind(now, rowId).run();
  }

  async unarchiveRow(rowId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare('UPDATE dt_rows SET _archived = 0, _updated_at = ? WHERE id = ?').bind(now, rowId).run();
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    const now = new Date().toISOString();
    const rows: Row[] = [];

    const statements = inputs.map((input) => {
      const id = this.generateId();
      const cells = input.cells ?? {};
      rows.push({
        id,
        tableId: input.tableId,
        cells,
        computed: {},
        archived: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
      return this.db
        .prepare(
          `INSERT INTO dt_rows (id, table_id, cells, computed, _title, _archived, _created_at, _updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, input.tableId, JSON.stringify(cells), null, null, 0, now, now);
    });

    await this.db.batch(statements);
    return rows;
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;

    const placeholders = rowIds.map(() => '?').join(', ');
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
    await this.db.prepare(`UPDATE dt_rows SET _archived = 1, _updated_at = ? WHERE id IN (${placeholders})`).bind(now, ...rowIds).run();
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
    const placeholders = targetIds.map(() => '?').join(', ');
    const rows = await this.db.prepare(`SELECT * FROM dt_rows WHERE id IN (${placeholders})`).bind(...targetIds).all<D1Row>();

    return rows.results.map((row) => this.mapRow(row));
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

  private mapRow(row: D1Row): Row {
    return {
      id: row.id,
      tableId: row.table_id,
      cells: JSON.parse(row.cells) as Record<string, CellValue>,
      computed: row.computed ? (JSON.parse(row.computed) as Record<string, CellValue>) : {},
      archived: row._archived === 1,
      createdAt: new Date(row._created_at),
      updatedAt: new Date(row._updated_at),
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
}

// Re-export types for convenience
export type { DatabaseAdapter } from '@marlinjai/data-table-core';
