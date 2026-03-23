/**
 * PrismaAdapter — PostgreSQL adapter using real table columns.
 *
 * Implements all 41 DatabaseAdapter methods. Stores scalar cell values
 * as TEXT columns in per-table SQL tables, junction data in shared tables.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import {
  BaseDatabaseAdapter,
  FormulaEngine,
  RollupEngine,
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
  type ColumnType,
  type FormulaColumnConfig,
  type RollupColumnConfig,
  type RelationColumnConfig,
} from '@marlinjai/data-table-core';

import {
  safeTableName,
  safeColumnName,
  isScalarType,
  serializeCell,
  deserializeCell,
  buildWhereClause,
  buildOrderBy,
  mergeFiles,
  mergeRelations,
  mergeSelections,
  buildBatchMap,
  type BatchFileResult,
  type BatchRelationResult,
  type BatchSelectResult,
} from '@marlinjai/data-table-adapter-shared';

import { createRealTable, dropRealTable, addColumn, dropColumn } from './ddl.js';
import { ensureRealTable } from './migration.js';

/** Convert a value to Prisma-compatible JSON input (handles null properly) */
function toJsonInput(value: unknown): InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as InputJsonValue;
}

export interface PrismaAdapterConfig {
  /** Prisma client instance */
  prisma: PrismaClient;
}

export class PrismaAdapter extends BaseDatabaseAdapter {
  private prisma: PrismaClient;
  private formulaEngine: FormulaEngine;
  private rollupEngine: RollupEngine;

  constructor(config: PrismaAdapterConfig) {
    super();
    this.prisma = config.prisma;
    this.formulaEngine = new FormulaEngine({ throwOnError: false });
    this.rollupEngine = new RollupEngine();
  }

  // =========================================================================
  // Tables
  // =========================================================================

  async createTable(input: CreateTableInput): Promise<Table> {
    const table = await this.prisma.dtTable.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        icon: input.icon,
        migrated: true, // New tables start as migrated (real table)
      },
    });

    // Create the real SQL table (empty, no user columns yet)
    await createRealTable(this.prisma, table.id, []);

    return this.mapTable(table);
  }

  async getTable(tableId: string): Promise<Table | null> {
    const table = await this.prisma.dtTable.findUnique({ where: { id: tableId } });
    return table ? this.mapTable(table) : null;
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    const table = await this.prisma.dtTable.update({
      where: { id: tableId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
      },
    });
    return this.mapTable(table);
  }

  async deleteTable(tableId: string): Promise<void> {
    // Eager file cleanup: delete file references (best-effort)
    const fileRefs = await this.prisma.dtFile.findMany({
      where: {
        rowId: {
          in: (
            await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM ${safeTableName(tableId)}`,
            ).catch(() => [])
          ).map((r) => r.id),
        },
      },
    });

    // Delete files (best-effort — don't block table deletion)
    if (fileRefs.length > 0) {
      await this.prisma.dtFile
        .deleteMany({
          where: { id: { in: fileRefs.map((f) => f.id) } },
        })
        .catch(() => {});
    }

    // Delete junction data
    const rowIds = (
      await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${safeTableName(tableId)}`,
      ).catch(() => [])
    ).map((r) => r.id);

    if (rowIds.length > 0) {
      await this.prisma.dtRelation.deleteMany({
        where: { sourceRowId: { in: rowIds } },
      });
      await this.prisma.dtRowSelectValue.deleteMany({
        where: { rowId: { in: rowIds } },
      });
    }

    // Drop the real table
    await dropRealTable(this.prisma, tableId);

    // Delete metadata
    await this.prisma.dtView.deleteMany({ where: { tableId } });
    const columns = await this.prisma.dtColumn.findMany({ where: { tableId } });
    for (const col of columns) {
      await this.prisma.selectOption.deleteMany({ where: { columnId: col.id } });
    }
    await this.prisma.dtColumn.deleteMany({ where: { tableId } });

    // Delete legacy rows if any
    await this.prisma.dtRow.deleteMany({ where: { tableId } }).catch(() => {});

    await this.prisma.dtTable.delete({ where: { id: tableId } });
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    const tables = await this.prisma.dtTable.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return tables.map((t) => this.mapTable(t));
  }

  // =========================================================================
  // Columns
  // =========================================================================

  async createColumn(input: CreateColumnInput): Promise<Column> {
    let position = input.position;
    if (position === undefined) {
      const maxPos = await this.prisma.dtColumn.aggregate({
        where: { tableId: input.tableId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? -1) + 1;
    }

    const column = await this.prisma.dtColumn.create({
      data: {
        tableId: input.tableId,
        name: input.name,
        type: input.type,
        position,
        width: input.width ?? 200,
        isPrimary: input.isPrimary ?? false,
        config: toJsonInput(input.config),
      },
    });

    // Add real SQL column using the generated column ID
    if (isScalarType(input.type)) {
      await addColumn(this.prisma, input.tableId, column.id);
    }

    return this.mapColumn(column);
  }

  async getColumns(tableId: string): Promise<Column[]> {
    const columns = await this.prisma.dtColumn.findMany({
      where: { tableId },
      orderBy: { position: 'asc' },
    });
    return columns.map((c) => this.mapColumn(c));
  }

  async getColumn(columnId: string): Promise<Column | null> {
    const column = await this.prisma.dtColumn.findUnique({ where: { id: columnId } });
    return column ? this.mapColumn(column) : null;
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    const column = await this.prisma.dtColumn.update({
      where: { id: columnId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.width !== undefined ? { width: updates.width } : {}),
        ...(updates.config !== undefined
          ? { config: toJsonInput(updates.config) }
          : {}),
        ...(updates.alignment !== undefined ? { alignment: updates.alignment } : {}),
      },
    });
    return this.mapColumn(column);
  }

  async deleteColumn(columnId: string): Promise<void> {
    const column = await this.prisma.dtColumn.findUnique({ where: { id: columnId } });
    if (!column) return;

    // Drop real SQL column if it's a scalar type
    if (isScalarType(column.type as ColumnType)) {
      await dropColumn(this.prisma, column.tableId, columnId).catch(() => {});
    }

    // Clean up junction data
    await this.prisma.selectOption.deleteMany({ where: { columnId } });
    await this.prisma.dtFile.deleteMany({ where: { columnId } });
    await this.prisma.dtRelation.deleteMany({ where: { sourceColumnId: columnId } });
    await this.prisma.dtRowSelectValue.deleteMany({ where: { columnId } });

    await this.prisma.dtColumn.delete({ where: { id: columnId } });
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      await this.prisma.dtColumn.update({
        where: { id: columnIds[i] },
        data: { position: i },
      });
    }
  }

  // =========================================================================
  // Select Options
  // =========================================================================

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    let position = input.position;
    if (position === undefined) {
      const maxPos = await this.prisma.selectOption.aggregate({
        where: { columnId: input.columnId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? -1) + 1;
    }

    const option = await this.prisma.selectOption.create({
      data: {
        columnId: input.columnId,
        name: input.name,
        color: input.color,
        position,
      },
    });

    return {
      id: option.id,
      columnId: option.columnId,
      name: option.name,
      color: option.color ?? undefined,
      position: option.position,
    };
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    const options = await this.prisma.selectOption.findMany({
      where: { columnId },
      orderBy: { position: 'asc' },
    });
    return options.map((o) => ({
      id: o.id,
      columnId: o.columnId,
      name: o.name,
      color: o.color ?? undefined,
      position: o.position,
    }));
  }

  async updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption> {
    const option = await this.prisma.selectOption.update({
      where: { id: optionId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.position !== undefined ? { position: updates.position } : {}),
      },
    });
    return {
      id: option.id,
      columnId: option.columnId,
      name: option.name,
      color: option.color ?? undefined,
      position: option.position,
    };
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    await this.prisma.selectOption.delete({ where: { id: optionId } });
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    for (let i = 0; i < optionIds.length; i++) {
      await this.prisma.selectOption.update({
        where: { id: optionIds[i] },
        data: { position: i },
      });
    }
  }

  // =========================================================================
  // Rows
  // =========================================================================

  async createRow(input: CreateRowInput): Promise<Row> {
    await ensureRealTable(this.prisma, input.tableId);

    const id = this.generateId();
    const now = new Date().toISOString();
    const tableName = safeTableName(input.tableId);
    const cells = input.cells ?? {};

    // Get columns for type-aware serialization
    const columns = await this.getColumns(input.tableId);
    const columnMap = new Map(columns.map((c) => [c.id, c]));

    // Build INSERT
    const colNames = ['id', '_archived', '_created_at', '_updated_at'];
    const placeholders = ['$1', '$2', '$3', '$4'];
    const values: unknown[] = [id, 0, now, now];
    let paramIdx = 5;

    if (input.parentRowId) {
      colNames.push('parent_row_id');
      placeholders.push(`$${paramIdx}`);
      values.push(input.parentRowId);
      paramIdx++;
    }

    for (const [colId, value] of Object.entries(cells)) {
      const col = columnMap.get(colId);
      if (col && isScalarType(col.type)) {
        const colName = safeColumnName(colId);
        colNames.push(colName);
        placeholders.push(`$${paramIdx}`);
        values.push(serializeCell(value, col.type));
        paramIdx++;
      }
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      ...values,
    );

    // Handle junction types (multi_select)
    for (const [colId, value] of Object.entries(cells)) {
      const col = columnMap.get(colId);
      if (col?.type === 'multi_select' && Array.isArray(value)) {
        for (const optionId of value) {
          if (typeof optionId === 'string') {
            await this.prisma.dtRowSelectValue.create({
              data: { rowId: id, columnId: colId, optionId },
            });
          }
        }
      }
    }

    return {
      id,
      tableId: input.tableId,
      parentRowId: input.parentRowId,
      cells,
      computed: {},
      archived: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async getRow(rowId: string): Promise<Row | null> {
    // Find which table this row belongs to
    const tableIds = await this.prisma.dtTable.findMany({
      where: { migrated: true },
      select: { id: true },
    });

    for (const { id: tableId } of tableIds) {
      const tableName = safeTableName(tableId);
      const rows = await this.prisma
        .$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          rowId,
        )
        .catch(() => []);

      if (rows.length > 0) {
        const row = rows[0]!;
        const columns = await this.getColumns(tableId);
        const mappedRow = this.mapRealRow(row, tableId, columns);

        // Eager-load junction data
        const [files, selections, relations] = await Promise.all([
          this.batchGetFilesForRows([rowId]),
          this.batchGetSelectionsForRows([rowId]),
          this.batchGetRelationsForRows([rowId]),
        ]);

        mergeFiles([mappedRow], files);
        mergeSelections([mappedRow], selections);
        mergeRelations([mappedRow], relations);

        // Compute formulas and rollups
        await this.computeFormulasAndRollups([mappedRow], columns);

        return mappedRow;
      }
    }

    return null;
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    await ensureRealTable(this.prisma, tableId);

    const tableName = safeTableName(tableId);
    const columns = await this.getColumns(tableId);
    const columnMap = new Map(columns.map((c) => [c.id, c]));

    // Build WHERE clause
    const conditions: string[] = [];
    const allParams: unknown[] = [];
    let paramIndex = 1;

    if (!query?.includeArchived) {
      conditions.push('_archived = 0');
    }

    if (query?.parentRowId !== undefined) {
      if (query.parentRowId === null) {
        conditions.push('parent_row_id IS NULL');
      } else {
        conditions.push(`parent_row_id = $${paramIndex}`);
        allParams.push(query.parentRowId);
        paramIndex++;
      }
    }

    if (query?.filters && query.filters.length > 0) {
      const filterResult = buildWhereClause(query.filters, columnMap, 'postgresql', paramIndex);
      conditions.push(filterResult.clause);
      allParams.push(...filterResult.params);
      paramIndex = filterResult.nextParamIndex;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    // Build ORDER BY
    const orderBy = query?.sorts?.length
      ? buildOrderBy(query.sorts, columnMap, 'postgresql')
      : '_created_at DESC';

    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;

    // Count query
    const countResult = await this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*)::int as count FROM ${tableName} WHERE ${whereClause}`,
      ...allParams,
    );
    const total = Number(countResult[0]?.count ?? 0);

    // Data query
    const rawRows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${tableName} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      ...allParams,
    );

    const rows = rawRows.map((r) => this.mapRealRow(r, tableId, columns));

    // Eager loading
    if (query?.include && rows.length > 0) {
      const rowIds = rows.map((r) => r.id);

      if (query.include.includes('files')) {
        const files = await this.batchGetFilesForRows(rowIds);
        mergeFiles(rows, files);
      }
      if (query.include.includes('multiSelect')) {
        const selections = await this.batchGetSelectionsForRows(rowIds);
        mergeSelections(rows, selections);
      }
      if (query.include.includes('relations')) {
        const relations = await this.batchGetRelationsForRows(rowIds);
        mergeRelations(rows, relations);
      }
    }

    // Compute formulas and rollups
    await this.computeFormulasAndRollups(rows, columns);

    return {
      items: rows,
      total,
      hasMore: offset + rows.length < total,
      cursor: offset + rows.length < total ? String(offset + limit) : undefined,
    };
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    // Find the table for this row
    const existingRow = await this.getRow(rowId);
    if (!existingRow) throw new Error('Row not found');

    const tableName = safeTableName(existingRow.tableId);
    const columns = await this.getColumns(existingRow.tableId);
    const columnMap = new Map(columns.map((c) => [c.id, c]));
    const now = new Date().toISOString();

    // Build UPDATE SET clause for scalar columns
    const setClauses: string[] = [`_updated_at = $1`];
    const values: unknown[] = [now];
    let paramIdx = 2;

    for (const [colId, value] of Object.entries(cells)) {
      const col = columnMap.get(colId);
      if (col && isScalarType(col.type)) {
        const colName = safeColumnName(colId);
        setClauses.push(`${colName} = $${paramIdx}`);
        values.push(serializeCell(value, col.type));
        paramIdx++;
      } else if (col?.type === 'multi_select' && Array.isArray(value)) {
        // Handle multi_select: delete old, insert new
        await this.prisma.dtRowSelectValue.deleteMany({
          where: { rowId, columnId: colId },
        });
        for (const optionId of value) {
          if (typeof optionId === 'string') {
            await this.prisma.dtRowSelectValue.create({
              data: { rowId, columnId: colId, optionId },
            });
          }
        }
      }
    }

    values.push(rowId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      ...values,
    );

    // Re-fetch to return updated row
    const updated = await this.getRow(rowId);
    if (!updated) throw new Error('Row not found after update');
    return updated;
  }

  async deleteRow(rowId: string): Promise<void> {
    const row = await this.getRow(rowId);
    if (!row) return;

    const tableName = safeTableName(row.tableId);

    // Eager file cleanup
    await this.prisma.dtFile.deleteMany({ where: { rowId } });
    await this.prisma.dtRelation.deleteMany({
      where: { OR: [{ sourceRowId: rowId }, { targetRowId: rowId }] },
    });
    await this.prisma.dtRowSelectValue.deleteMany({ where: { rowId } });

    await this.prisma.$executeRawUnsafe(`DELETE FROM ${tableName} WHERE id = $1`, rowId);
  }

  async archiveRow(rowId: string): Promise<void> {
    const row = await this.getRow(rowId);
    if (!row) return;
    const tableName = safeTableName(row.tableId);
    const now = new Date().toISOString();
    await this.prisma.$executeRawUnsafe(
      `UPDATE ${tableName} SET _archived = 1, _updated_at = $1 WHERE id = $2`,
      now,
      rowId,
    );
  }

  async unarchiveRow(rowId: string): Promise<void> {
    const row = await this.getRow(rowId);
    if (!row) return;
    const tableName = safeTableName(row.tableId);
    const now = new Date().toISOString();
    await this.prisma.$executeRawUnsafe(
      `UPDATE ${tableName} SET _archived = 0, _updated_at = $1 WHERE id = $2`,
      now,
      rowId,
    );
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    const rows: Row[] = [];
    for (const input of inputs) {
      rows.push(await this.createRow(input));
    }
    return rows;
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;
    for (const rowId of rowIds) {
      await this.deleteRow(rowId);
    }
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;
    for (const rowId of rowIds) {
      await this.archiveRow(rowId);
    }
  }

  // =========================================================================
  // Relations
  // =========================================================================

  async createRelation(input: CreateRelationInput): Promise<void> {
    await this.prisma.dtRelation.upsert({
      where: {
        sourceRowId_sourceColumnId_targetRowId: {
          sourceRowId: input.sourceRowId,
          sourceColumnId: input.sourceColumnId,
          targetRowId: input.targetRowId,
        },
      },
      create: {
        sourceRowId: input.sourceRowId,
        sourceColumnId: input.sourceColumnId,
        targetRowId: input.targetRowId,
      },
      update: {},
    });
  }

  async deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void> {
    await this.prisma.dtRelation
      .delete({
        where: {
          sourceRowId_sourceColumnId_targetRowId: {
            sourceRowId,
            sourceColumnId: columnId,
            targetRowId,
          },
        },
      })
      .catch(() => {}); // Ignore if not found
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    const relations = await this.prisma.dtRelation.findMany({
      where: { sourceRowId: rowId, sourceColumnId: columnId },
    });
    if (relations.length === 0) return [];

    const rows: Row[] = [];
    for (const rel of relations) {
      const row = await this.getRow(rel.targetRowId);
      if (row) rows.push(row);
    }
    return rows;
  }

  async getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>> {
    const relations = await this.prisma.dtRelation.findMany({
      where: { sourceRowId: rowId },
    });
    return relations.map((r) => ({
      columnId: r.sourceColumnId,
      targetRowId: r.targetRowId,
    }));
  }

  // =========================================================================
  // File References
  // =========================================================================

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    let position = input.position;
    if (position === undefined) {
      const maxPos = await this.prisma.dtFile.aggregate({
        where: { rowId: input.rowId, columnId: input.columnId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? -1) + 1;
    }

    const file = await this.prisma.dtFile.create({
      data: {
        rowId: input.rowId,
        columnId: input.columnId,
        fileId: input.fileId,
        fileUrl: input.fileUrl,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        position,
        metadata: toJsonInput(input.metadata),
      },
    });

    return this.mapFileRef(file);
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    await this.prisma.dtFile.delete({ where: { id: fileRefId } });
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    const files = await this.prisma.dtFile.findMany({
      where: { rowId, columnId },
      orderBy: { position: 'asc' },
    });
    return files.map((f) => this.mapFileRef(f));
  }

  async reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void> {
    for (let i = 0; i < fileRefIds.length; i++) {
      await this.prisma.dtFile.update({
        where: { id: fileRefIds[i] },
        data: { position: i },
      });
    }
  }

  // =========================================================================
  // Views
  // =========================================================================

  async createView(input: CreateViewInput): Promise<View> {
    let position = input.position;
    if (position === undefined) {
      const maxPos = await this.prisma.dtView.aggregate({
        where: { tableId: input.tableId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? -1) + 1;
    }

    const count = await this.prisma.dtView.count({ where: { tableId: input.tableId } });
    const isDefault = input.isDefault ?? count === 0;

    if (isDefault) {
      await this.prisma.dtView.updateMany({
        where: { tableId: input.tableId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await this.prisma.dtView.create({
      data: {
        tableId: input.tableId,
        name: input.name,
        type: input.type,
        isDefault,
        position,
        config: toJsonInput(input.config),
      },
    });

    return this.mapView(view);
  }

  async getViews(tableId: string): Promise<View[]> {
    const views = await this.prisma.dtView.findMany({
      where: { tableId },
      orderBy: { position: 'asc' },
    });
    return views.map((v) => this.mapView(v));
  }

  async getView(viewId: string): Promise<View | null> {
    const view = await this.prisma.dtView.findUnique({ where: { id: viewId } });
    return view ? this.mapView(view) : null;
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    const existing = await this.prisma.dtView.findUnique({ where: { id: viewId } });
    if (!existing) throw new Error('View not found');

    if (updates.isDefault) {
      await this.prisma.dtView.updateMany({
        where: { tableId: existing.tableId, id: { not: viewId } },
        data: { isDefault: false },
      });
    }

    const mergedConfig =
      updates.config !== undefined
        ? updates.config
          ? { ...((existing.config as Record<string, unknown>) ?? {}), ...(updates.config as Record<string, unknown>) }
          : null
        : undefined;

    const view = await this.prisma.dtView.update({
      where: { id: viewId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.type !== undefined ? { type: updates.type } : {}),
        ...(updates.isDefault !== undefined ? { isDefault: updates.isDefault } : {}),
        ...(mergedConfig !== undefined ? { config: toJsonInput(mergedConfig) } : {}),
      },
    });

    return this.mapView(view);
  }

  async deleteView(viewId: string): Promise<void> {
    const view = await this.prisma.dtView.findUnique({ where: { id: viewId } });
    if (!view) return;

    await this.prisma.dtView.delete({ where: { id: viewId } });

    if (view.isDefault) {
      const nextView = await this.prisma.dtView.findFirst({
        where: { tableId: view.tableId },
        orderBy: { position: 'asc' },
      });
      if (nextView) {
        await this.prisma.dtView.update({
          where: { id: nextView.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    for (let i = 0; i < viewIds.length; i++) {
      await this.prisma.dtView.update({
        where: { id: viewIds[i] },
        data: { position: i },
      });
    }
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    return fn(this);
  }

  // =========================================================================
  // Formula & Rollup Computation (private)
  // =========================================================================

  /**
   * Compute formula and rollup columns for a set of rows.
   * Formulas are computed in-app via FormulaEngine.
   * Rollups are computed via RollupEngine after fetching related rows.
   */
  private async computeFormulasAndRollups(
    rows: Row[],
    columns: Column[],
  ): Promise<void> {
    const formulaColumns = columns.filter((c) => c.type === 'formula');
    const rollupColumns = columns.filter((c) => c.type === 'rollup');

    // Compute formulas
    if (formulaColumns.length > 0) {
      for (const row of rows) {
        for (const fc of formulaColumns) {
          const config = fc.config as FormulaColumnConfig | undefined;
          if (config?.formula) {
            row.cells[fc.id] = this.formulaEngine.evaluate(config.formula, row, columns);
          }
        }
      }
    }

    // Compute rollups
    if (rollupColumns.length > 0) {
      for (const rc of rollupColumns) {
        const config = rc.config as RollupColumnConfig | undefined;
        if (!config) continue;

        // Get the relation column to find the target table
        const relationColumn = columns.find((c) => c.id === config.relationColumnId);
        if (!relationColumn) continue;

        const relationConfig = relationColumn.config as RelationColumnConfig | undefined;
        if (!relationConfig?.targetTableId) continue;

        // Get target columns for the rollup
        const targetColumns = await this.getColumns(relationConfig.targetTableId);
        const targetColumn = targetColumns.find((c) => c.id === config.targetColumnId);
        if (!targetColumn) continue;

        for (const row of rows) {
          const relatedRows = await this.getRelatedRows(row.id, config.relationColumnId);
          const rollupResult = this.rollupEngine.calculate(config, relatedRows, targetColumn);
          // RollupResult can be number | CellValue[] | null — coerce to CellValue
          row.cells[rc.id] = rollupResult as CellValue;
        }
      }
    }
  }

  // =========================================================================
  // Batch Loading (private)
  // =========================================================================

  private async batchGetFilesForRows(rowIds: string[]): Promise<BatchFileResult> {
    if (rowIds.length === 0) return new Map();
    const files = await this.prisma.dtFile.findMany({
      where: { rowId: { in: rowIds } },
      orderBy: { position: 'asc' },
    });

    return buildBatchMap(
      files.map((f) => ({
        rowId: f.rowId,
        columnId: f.columnId,
        value: this.mapFileRef(f),
      })),
    ) as BatchFileResult;
  }

  private async batchGetSelectionsForRows(rowIds: string[]): Promise<BatchSelectResult> {
    if (rowIds.length === 0) return new Map();
    const selections = await this.prisma.dtRowSelectValue.findMany({
      where: { rowId: { in: rowIds } },
    });

    return buildBatchMap(
      selections.map((s) => ({
        rowId: s.rowId,
        columnId: s.columnId,
        value: s.optionId,
      })),
    ) as BatchSelectResult;
  }

  private async batchGetRelationsForRows(rowIds: string[]): Promise<BatchRelationResult> {
    if (rowIds.length === 0) return new Map();
    const relations = await this.prisma.dtRelation.findMany({
      where: { sourceRowId: { in: rowIds } },
    });

    return buildBatchMap(
      relations.map((r) => ({
        rowId: r.sourceRowId,
        columnId: r.sourceColumnId,
        value: { rowId: r.targetRowId },
      })),
    ) as BatchRelationResult;
  }

  // =========================================================================
  // Mappers (private)
  // =========================================================================

  private mapTable(t: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    icon: string | null;
    migrated: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Table {
    return {
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      description: t.description ?? undefined,
      icon: t.icon ?? undefined,
      migrated: t.migrated,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private mapColumn(c: {
    id: string;
    tableId: string;
    name: string;
    type: string;
    position: number;
    width: number;
    isPrimary: boolean;
    config: unknown;
    alignment: string | null;
    createdAt: Date;
  }): Column {
    return {
      id: c.id,
      tableId: c.tableId,
      name: c.name,
      type: c.type as ColumnType,
      position: c.position,
      width: c.width,
      isPrimary: c.isPrimary,
      config: c.config ? (c.config as ColumnConfig) : undefined,
      alignment: (c.alignment as Column['alignment']) ?? undefined,
      createdAt: c.createdAt,
    };
  }

  private mapRealRow(
    raw: Record<string, unknown>,
    tableId: string,
    columns: Column[],
  ): Row {
    const cells: Record<string, CellValue> = {};

    for (const col of columns) {
      if (isScalarType(col.type)) {
        const rawValue = raw[safeColumnName(col.id)];
        cells[col.id] = deserializeCell(
          rawValue != null ? String(rawValue) : null,
          col.type,
        );
      }
    }

    return {
      id: raw.id as string,
      tableId,
      parentRowId: (raw.parent_row_id as string) ?? undefined,
      cells,
      computed: {},
      archived: raw._archived === 1 || raw._archived === true,
      createdAt: new Date(raw._created_at as string),
      updatedAt: new Date(raw._updated_at as string),
    };
  }

  private mapView(v: {
    id: string;
    tableId: string;
    name: string;
    type: string;
    isDefault: boolean;
    position: number;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): View {
    return {
      id: v.id,
      tableId: v.tableId,
      name: v.name,
      type: v.type as View['type'],
      isDefault: v.isDefault,
      position: v.position,
      config: v.config ? (v.config as ViewConfig) : {},
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private mapFileRef(f: {
    id: string;
    rowId: string;
    columnId: string;
    fileId: string;
    fileUrl: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number | null;
    position: number;
    metadata: unknown;
  }): FileReference {
    return {
      id: f.id,
      rowId: f.rowId,
      columnId: f.columnId,
      fileId: f.fileId,
      fileUrl: f.fileUrl,
      originalName: f.originalName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes ?? undefined,
      position: f.position,
      metadata: f.metadata ? (f.metadata as Record<string, unknown>) : undefined,
    };
  }
}
