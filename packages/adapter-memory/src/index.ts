/**
 * @marlinjai/data-table-adapter-memory
 *
 * In-memory adapter for testing and demos
 */

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
  type DatabaseAdapter,
} from '@marlinjai/data-table-core';

interface StoredRelation {
  id: string;
  sourceRowId: string;
  sourceColumnId: string;
  targetRowId: string;
  createdAt: Date;
}

export class MemoryAdapter extends BaseDatabaseAdapter {
  private tables: Map<string, Table> = new Map();
  private columns: Map<string, Column> = new Map();
  private rows: Map<string, Row> = new Map();
  private selectOptions: Map<string, SelectOption> = new Map();
  private fileReferences: Map<string, FileReference> = new Map();
  private relations: Map<string, StoredRelation> = new Map();
  private views: Map<string, View> = new Map();

  // =========================================================================
  // Tables
  // =========================================================================

  async createTable(input: CreateTableInput): Promise<Table> {
    const id = this.generateId();
    const now = new Date();

    const table: Table = {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
    };

    this.tables.set(id, table);
    return table;
  }

  async getTable(tableId: string): Promise<Table | null> {
    return this.tables.get(tableId) ?? null;
  }

  async updateTable(tableId: string, updates: UpdateTableInput): Promise<Table> {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('Table not found');

    const updated: Table = {
      ...table,
      ...updates,
      updatedAt: new Date(),
    };

    this.tables.set(tableId, updated);
    return updated;
  }

  async deleteTable(tableId: string): Promise<void> {
    // Delete all related data
    for (const [id, col] of this.columns) {
      if (col.tableId === tableId) {
        this.columns.delete(id);
        // Delete select options for this column
        for (const [optId, opt] of this.selectOptions) {
          if (opt.columnId === id) this.selectOptions.delete(optId);
        }
      }
    }

    for (const [id, row] of this.rows) {
      if (row.tableId === tableId) {
        this.rows.delete(id);
        // Delete file references for this row
        for (const [refId, ref] of this.fileReferences) {
          if (ref.rowId === id) this.fileReferences.delete(refId);
        }
      }
    }

    // Delete views for this table
    for (const [id, view] of this.views) {
      if (view.tableId === tableId) this.views.delete(id);
    }

    this.tables.delete(tableId);
  }

  async listTables(workspaceId: string): Promise<Table[]> {
    return Array.from(this.tables.values())
      .filter((t) => t.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // =========================================================================
  // Columns
  // =========================================================================

  async createColumn(input: CreateColumnInput): Promise<Column> {
    const id = this.generateId();
    const now = new Date();

    // Get next position
    const tableColumns = Array.from(this.columns.values()).filter(
      (c) => c.tableId === input.tableId
    );
    const position = input.position ?? tableColumns.length;

    const column: Column = {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      position,
      width: input.width ?? 200,
      isPrimary: input.isPrimary ?? false,
      config: input.config,
      createdAt: now,
    };

    this.columns.set(id, column);
    return column;
  }

  async getColumns(tableId: string): Promise<Column[]> {
    return Array.from(this.columns.values())
      .filter((c) => c.tableId === tableId)
      .sort((a, b) => a.position - b.position);
  }

  async getColumn(columnId: string): Promise<Column | null> {
    return this.columns.get(columnId) ?? null;
  }

  async updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column> {
    const column = this.columns.get(columnId);
    if (!column) throw new Error('Column not found');

    const updated: Column = {
      ...column,
      ...updates,
    };

    this.columns.set(columnId, updated);
    return updated;
  }

  async deleteColumn(columnId: string): Promise<void> {
    // Delete select options
    for (const [id, opt] of this.selectOptions) {
      if (opt.columnId === columnId) this.selectOptions.delete(id);
    }

    // Delete file references
    for (const [id, ref] of this.fileReferences) {
      if (ref.columnId === columnId) this.fileReferences.delete(id);
    }

    // Delete relations
    for (const [id, rel] of this.relations) {
      if (rel.sourceColumnId === columnId) this.relations.delete(id);
    }

    this.columns.delete(columnId);
  }

  async reorderColumns(tableId: string, columnIds: string[]): Promise<void> {
    columnIds.forEach((id, index) => {
      const column = this.columns.get(id);
      if (column && column.tableId === tableId) {
        this.columns.set(id, { ...column, position: index });
      }
    });
  }

  // =========================================================================
  // Select Options
  // =========================================================================

  async createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption> {
    const id = this.generateId();

    const columnOptions = Array.from(this.selectOptions.values()).filter(
      (o) => o.columnId === input.columnId
    );
    const position = input.position ?? columnOptions.length;

    const option: SelectOption = {
      id,
      columnId: input.columnId,
      name: input.name,
      color: input.color,
      position,
    };

    this.selectOptions.set(id, option);
    return option;
  }

  async getSelectOptions(columnId: string): Promise<SelectOption[]> {
    return Array.from(this.selectOptions.values())
      .filter((o) => o.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  async updateSelectOption(
    optionId: string,
    updates: UpdateSelectOptionInput
  ): Promise<SelectOption> {
    const option = this.selectOptions.get(optionId);
    if (!option) throw new Error('Select option not found');

    const updated: SelectOption = {
      ...option,
      ...updates,
    };

    this.selectOptions.set(optionId, updated);
    return updated;
  }

  async deleteSelectOption(optionId: string): Promise<void> {
    this.selectOptions.delete(optionId);
  }

  async reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void> {
    optionIds.forEach((id, index) => {
      const option = this.selectOptions.get(id);
      if (option && option.columnId === columnId) {
        this.selectOptions.set(id, { ...option, position: index });
      }
    });
  }

  // =========================================================================
  // Rows
  // =========================================================================

  async createRow(input: CreateRowInput): Promise<Row> {
    const id = this.generateId();
    const now = new Date();

    // Auto-populate timestamp columns
    const cells: Record<string, CellValue> = input.cells ? { ...input.cells } : {};
    const tableColumns = Array.from(this.columns.values()).filter(
      (c) => c.tableId === input.tableId
    );
    for (const col of tableColumns) {
      if (col.type === 'created_time' || col.type === 'last_edited_time') {
        cells[col.id] = now;
      }
    }

    const row: Row = {
      id,
      tableId: input.tableId,
      parentRowId: input.parentRowId,
      cells,
      computed: {},
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    this.rows.set(id, row);
    return row;
  }

  async getRow(rowId: string): Promise<Row | null> {
    return this.rows.get(rowId) ?? null;
  }

  async getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>> {
    let rows = Array.from(this.rows.values()).filter((r) => r.tableId === tableId);

    // Filter archived
    if (!query?.includeArchived) {
      rows = rows.filter((r) => !r.archived);
    }

    // Filter by parentRowId (sub-items filtering)
    if (query?.parentRowId !== undefined) {
      if (query.parentRowId === null) {
        // null = top-level only (no parent)
        rows = rows.filter((r) => !r.parentRowId);
      } else {
        // string = children of specific parent
        rows = rows.filter((r) => r.parentRowId === query.parentRowId);
      }
    }

    // If includeSubItems is true and we're fetching top-level, include all descendants recursively
    // (This is handled in getAllDescendants helper, but here we just return all rows without parent filtering)
    if (query?.includeSubItems && query?.parentRowId === null) {
      // Reset to all rows (no parent filtering)
      rows = Array.from(this.rows.values()).filter((r) => r.tableId === tableId);
      if (!query?.includeArchived) {
        rows = rows.filter((r) => !r.archived);
      }
    }

    // Apply filters
    if (query?.filters) {
      for (const filter of query.filters) {
        rows = rows.filter((row) => {
          const value = row.cells[filter.columnId];

          switch (filter.operator) {
            case 'equals':
              return value === filter.value;
            case 'notEquals':
              return value !== filter.value;
            case 'contains':
              return String(value ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase());
            case 'isEmpty':
              return value === null || value === undefined || value === '';
            case 'isNotEmpty':
              return value !== null && value !== undefined && value !== '';
            case 'greaterThan':
              return Number(value) > Number(filter.value);
            case 'lessThan':
              return Number(value) < Number(filter.value);
            default:
              return true;
          }
        });
      }
    }

    // Apply sorts
    if (query?.sorts && query.sorts.length > 0) {
      rows.sort((a, b) => {
        for (const sort of query.sorts!) {
          const aVal = a.cells[sort.columnId];
          const bVal = b.cells[sort.columnId];

          let comparison = 0;
          if (aVal === null || aVal === undefined) comparison = 1;
          else if (bVal === null || bVal === undefined) comparison = -1;
          else if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;

          if (comparison !== 0) {
            return sort.direction === 'desc' ? -comparison : comparison;
          }
        }
        return 0;
      });
    } else {
      // Default sort by created date descending
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const total = rows.length;

    // Apply pagination
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    rows = rows.slice(offset, offset + limit);

    return {
      items: rows,
      total,
      hasMore: offset + rows.length < total,
      cursor: offset + rows.length < total ? String(offset + limit) : undefined,
    };
  }

  async updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row> {
    const row = this.rows.get(rowId);
    if (!row) throw new Error('Row not found');

    const now = new Date();

    // Auto-update last_edited_time columns
    const updatedCells = { ...row.cells, ...cells };
    const tableColumns = Array.from(this.columns.values()).filter(
      (c) => c.tableId === row.tableId
    );
    for (const col of tableColumns) {
      if (col.type === 'last_edited_time') {
        updatedCells[col.id] = now;
      }
    }

    const updated: Row = {
      ...row,
      cells: updatedCells,
      updatedAt: now,
    };

    this.rows.set(rowId, updated);
    return updated;
  }

  async deleteRow(rowId: string): Promise<void> {
    // Delete file references
    for (const [id, ref] of this.fileReferences) {
      if (ref.rowId === rowId) this.fileReferences.delete(id);
    }

    // Delete relations
    for (const [id, rel] of this.relations) {
      if (rel.sourceRowId === rowId || rel.targetRowId === rowId) {
        this.relations.delete(id);
      }
    }

    this.rows.delete(rowId);
  }

  async archiveRow(rowId: string): Promise<void> {
    const row = this.rows.get(rowId);
    if (!row) throw new Error('Row not found');

    this.rows.set(rowId, { ...row, archived: true, updatedAt: new Date() });
  }

  async unarchiveRow(rowId: string): Promise<void> {
    const row = this.rows.get(rowId);
    if (!row) throw new Error('Row not found');

    this.rows.set(rowId, { ...row, archived: false, updatedAt: new Date() });
  }

  async bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]> {
    return Promise.all(inputs.map((input) => this.createRow(input)));
  }

  async bulkDeleteRows(rowIds: string[]): Promise<void> {
    await Promise.all(rowIds.map((id) => this.deleteRow(id)));
  }

  async bulkArchiveRows(rowIds: string[]): Promise<void> {
    await Promise.all(rowIds.map((id) => this.archiveRow(id)));
  }

  // =========================================================================
  // Sub-items Helpers
  // =========================================================================

  /**
   * Get all descendant rows of a parent row recursively
   */
  async getDescendants(rowId: string): Promise<Row[]> {
    const descendants: Row[] = [];
    const directChildren = Array.from(this.rows.values()).filter(
      (r) => r.parentRowId === rowId && !r.archived
    );

    for (const child of directChildren) {
      descendants.push(child);
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Get the depth (nesting level) of a row in the hierarchy
   * Returns 0 for top-level rows, 1 for children, 2 for grandchildren, etc.
   */
  getRowDepth(rowId: string): number {
    const row = this.rows.get(rowId);
    if (!row || !row.parentRowId) return 0;
    return 1 + this.getRowDepth(row.parentRowId);
  }

  /**
   * Check if a row has any children
   */
  hasChildren(rowId: string): boolean {
    return Array.from(this.rows.values()).some(
      (r) => r.parentRowId === rowId && !r.archived
    );
  }

  /**
   * Get direct children of a row
   */
  async getChildren(rowId: string): Promise<Row[]> {
    return Array.from(this.rows.values()).filter(
      (r) => r.parentRowId === rowId && !r.archived
    );
  }

  // =========================================================================
  // Relations
  // =========================================================================

  async createRelation(input: CreateRelationInput): Promise<void> {
    const id = this.generateId();

    const relation: StoredRelation = {
      id,
      sourceRowId: input.sourceRowId,
      sourceColumnId: input.sourceColumnId,
      targetRowId: input.targetRowId,
      createdAt: new Date(),
    };

    this.relations.set(id, relation);
  }

  async deleteRelation(
    sourceRowId: string,
    columnId: string,
    targetRowId: string
  ): Promise<void> {
    for (const [id, rel] of this.relations) {
      if (
        rel.sourceRowId === sourceRowId &&
        rel.sourceColumnId === columnId &&
        rel.targetRowId === targetRowId
      ) {
        this.relations.delete(id);
        break;
      }
    }
  }

  async getRelatedRows(rowId: string, columnId: string): Promise<Row[]> {
    const targetIds = Array.from(this.relations.values())
      .filter((r) => r.sourceRowId === rowId && r.sourceColumnId === columnId)
      .map((r) => r.targetRowId);

    return targetIds
      .map((id) => this.rows.get(id))
      .filter((r): r is Row => r !== undefined);
  }

  async getRelationsForRow(
    rowId: string
  ): Promise<Array<{ columnId: string; targetRowId: string }>> {
    return Array.from(this.relations.values())
      .filter((r) => r.sourceRowId === rowId)
      .map((r) => ({ columnId: r.sourceColumnId, targetRowId: r.targetRowId }));
  }

  // =========================================================================
  // File References
  // =========================================================================

  async addFileReference(input: CreateFileRefInput): Promise<FileReference> {
    const id = this.generateId();

    const refs = Array.from(this.fileReferences.values()).filter(
      (r) => r.rowId === input.rowId && r.columnId === input.columnId
    );
    const position = input.position ?? refs.length;

    const ref: FileReference = {
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

    this.fileReferences.set(id, ref);
    return ref;
  }

  async removeFileReference(fileRefId: string): Promise<void> {
    this.fileReferences.delete(fileRefId);
  }

  async getFileReferences(rowId: string, columnId: string): Promise<FileReference[]> {
    return Array.from(this.fileReferences.values())
      .filter((r) => r.rowId === rowId && r.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  async reorderFileReferences(
    rowId: string,
    columnId: string,
    fileRefIds: string[]
  ): Promise<void> {
    fileRefIds.forEach((id, index) => {
      const ref = this.fileReferences.get(id);
      if (ref && ref.rowId === rowId && ref.columnId === columnId) {
        this.fileReferences.set(id, { ...ref, position: index });
      }
    });
  }

  // =========================================================================
  // Views
  // =========================================================================

  async createView(input: CreateViewInput): Promise<View> {
    const id = this.generateId();
    const now = new Date();

    // Get next position if not specified
    const tableViews = Array.from(this.views.values()).filter(
      (v) => v.tableId === input.tableId
    );
    const position = input.position ?? tableViews.length;

    // If this is the first view or marked as default, set isDefault to true
    const isDefault = input.isDefault ?? tableViews.length === 0;

    // If this view is default, unset default on other views
    if (isDefault) {
      for (const view of tableViews) {
        if (view.isDefault) {
          this.views.set(view.id, { ...view, isDefault: false, updatedAt: now });
        }
      }
    }

    const view: View = {
      id,
      tableId: input.tableId,
      name: input.name,
      type: input.type,
      isDefault,
      position,
      config: input.config ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.views.set(id, view);
    return view;
  }

  async getViews(tableId: string): Promise<View[]> {
    return Array.from(this.views.values())
      .filter((v) => v.tableId === tableId)
      .sort((a, b) => a.position - b.position);
  }

  async getView(viewId: string): Promise<View | null> {
    return this.views.get(viewId) ?? null;
  }

  async updateView(viewId: string, updates: UpdateViewInput): Promise<View> {
    const view = this.views.get(viewId);
    if (!view) throw new Error('View not found');

    const now = new Date();

    // If setting this view as default, unset default on other views
    if (updates.isDefault === true) {
      const tableViews = Array.from(this.views.values()).filter(
        (v) => v.tableId === view.tableId && v.id !== viewId
      );
      for (const v of tableViews) {
        if (v.isDefault) {
          this.views.set(v.id, { ...v, isDefault: false, updatedAt: now });
        }
      }
    }

    const updated: View = {
      ...view,
      ...updates,
      config: updates.config !== undefined
        ? { ...view.config, ...updates.config }
        : view.config,
      updatedAt: now,
    };

    this.views.set(viewId, updated);
    return updated;
  }

  async deleteView(viewId: string): Promise<void> {
    const view = this.views.get(viewId);
    if (!view) return;

    this.views.delete(viewId);

    // If the deleted view was default, make the first remaining view default
    if (view.isDefault) {
      const remainingViews = Array.from(this.views.values())
        .filter((v) => v.tableId === view.tableId)
        .sort((a, b) => a.position - b.position);

      if (remainingViews.length > 0) {
        const newDefault = remainingViews[0];
        this.views.set(newDefault.id, { ...newDefault, isDefault: true, updatedAt: new Date() });
      }
    }
  }

  async reorderViews(tableId: string, viewIds: string[]): Promise<void> {
    viewIds.forEach((id, index) => {
      const view = this.views.get(id);
      if (view && view.tableId === tableId) {
        this.views.set(id, { ...view, position: index });
      }
    });
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // In-memory adapter doesn't need real transactions
    return fn(this);
  }

  // =========================================================================
  // Utility: Seed with sample data
  // =========================================================================

  async seedSampleData(workspaceId: string): Promise<{ tableId: string; projectsTableId: string }> {
    // =========================================================================
    // Create Projects table
    // =========================================================================
    const projectsTable = await this.createTable({
      workspaceId,
      name: 'Projects',
      description: 'Track your projects and their status',
      icon: '📁',
    });

    // Create Projects columns
    const projectNameCol = await this.createColumn({
      tableId: projectsTable.id,
      name: 'Name',
      type: 'text',
      isPrimary: true,
    });

    const projectBudgetCol = await this.createColumn({
      tableId: projectsTable.id,
      name: 'Budget',
      type: 'number',
      config: { format: 'currency', currencyCode: 'USD', precision: 2 },
    });

    const projectStatusCol = await this.createColumn({
      tableId: projectsTable.id,
      name: 'Status',
      type: 'select',
    });

    const projectDescriptionCol = await this.createColumn({
      tableId: projectsTable.id,
      name: 'Description',
      type: 'text',
    });

    // Create project status options
    const projectStatuses = [
      { name: 'Active', color: 'green' },
      { name: 'Completed', color: 'blue' },
      { name: 'On Hold', color: 'yellow' },
    ];

    const projectStatusOptions: SelectOption[] = [];
    for (const status of projectStatuses) {
      const opt = await this.createSelectOption({
        columnId: projectStatusCol.id,
        name: status.name,
        color: status.color,
      });
      projectStatusOptions.push(opt);
    }

    // Create sample projects
    const projectsData = [
      {
        [projectNameCol.id]: 'Marketing Campaign',
        [projectBudgetCol.id]: 50000,
        [projectStatusCol.id]: projectStatusOptions[0].id, // Active
        [projectDescriptionCol.id]: 'Q1 2025 digital marketing campaign across all channels',
      },
      {
        [projectNameCol.id]: 'Website Redesign',
        [projectBudgetCol.id]: 75000,
        [projectStatusCol.id]: projectStatusOptions[0].id, // Active
        [projectDescriptionCol.id]: 'Complete overhaul of company website with new branding',
      },
      {
        [projectNameCol.id]: 'Q1 Planning',
        [projectBudgetCol.id]: 15000,
        [projectStatusCol.id]: projectStatusOptions[1].id, // Completed
        [projectDescriptionCol.id]: 'Strategic planning sessions for Q1 objectives',
      },
      {
        [projectNameCol.id]: 'Mobile App Development',
        [projectBudgetCol.id]: 120000,
        [projectStatusCol.id]: projectStatusOptions[2].id, // On Hold
        [projectDescriptionCol.id]: 'Native mobile app for iOS and Android platforms',
      },
    ];

    const projectRows: Row[] = [];
    for (const data of projectsData) {
      const row = await this.createRow({ tableId: projectsTable.id, cells: data });
      projectRows.push(row);
    }

    // =========================================================================
    // Create Receipts table
    // =========================================================================
    const receiptsTable = await this.createTable({
      workspaceId,
      name: 'Receipts',
      description: 'Track your receipts and expenses',
      icon: '🧾',
    });

    // Create columns
    const nameCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Name',
      type: 'text',
      isPrimary: true,
    });

    const vendorCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Vendor',
      type: 'text',
    });

    const amountCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Amount',
      type: 'number',
      config: { format: 'currency', currencyCode: 'USD', precision: 2 },
    });

    const dateCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Date',
      type: 'date',
    });

    const categoryCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Category',
      type: 'select',
    });

    const statusCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Status',
      type: 'select',
    });

    const reimbursedCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Reimbursed',
      type: 'boolean',
    });

    const notesCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Notes',
      type: 'text',
    });

    const receiptCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Receipt',
      type: 'file',
    });

    // New columns: Project (relation), Tags (multi_select), Link (url), Amount + Tax (formula)
    const projectCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Project',
      type: 'relation',
      config: {
        targetTableId: projectsTable.id,
        limitType: 'single',
      },
    });

    const tagsCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Tags',
      type: 'multi_select',
    });

    const linkCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Link',
      type: 'url',
    });

    const amountWithTaxCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Amount + Tax',
      type: 'formula',
      config: {
        formula: 'prop("Amount") * 1.08',
        resultType: 'number',
      },
    });

    // Auto-timestamp columns
    const createdTimeCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Created',
      type: 'created_time',
      config: {
        includeTime: true,
      },
    });

    const lastEditedTimeCol = await this.createColumn({
      tableId: receiptsTable.id,
      name: 'Last Edited',
      type: 'last_edited_time',
      config: {
        includeTime: true,
      },
    });

    // Create category options
    const categories = [
      { name: 'Food & Dining', color: 'orange' },
      { name: 'Transportation', color: 'blue' },
      { name: 'Office Supplies', color: 'gray' },
      { name: 'Software', color: 'purple' },
      { name: 'Travel', color: 'green' },
      { name: 'Other', color: 'gray' },
    ];

    const categoryOptions: SelectOption[] = [];
    for (const cat of categories) {
      const opt = await this.createSelectOption({
        columnId: categoryCol.id,
        name: cat.name,
        color: cat.color,
      });
      categoryOptions.push(opt);
    }

    // Create status options
    const statuses = [
      { name: 'Pending', color: 'yellow' },
      { name: 'Processed', color: 'green' },
      { name: 'Rejected', color: 'red' },
    ];

    const statusOptions: SelectOption[] = [];
    for (const status of statuses) {
      const opt = await this.createSelectOption({
        columnId: statusCol.id,
        name: status.name,
        color: status.color,
      });
      statusOptions.push(opt);
    }

    // Create tags options for multi_select
    const tags = [
      { name: 'Urgent', color: 'red' },
      { name: 'Billable', color: 'green' },
      { name: 'Tax Deductible', color: 'blue' },
      { name: 'Recurring', color: 'purple' },
    ];

    const tagOptions: SelectOption[] = [];
    for (const tag of tags) {
      const opt = await this.createSelectOption({
        columnId: tagsCol.id,
        name: tag.name,
        color: tag.color,
      });
      tagOptions.push(opt);
    }

    // Create sample rows with new column data
    const sampleData = [
      {
        [nameCol.id]: 'Uber to Airport',
        [vendorCol.id]: 'Uber',
        [amountCol.id]: 45.50,
        [dateCol.id]: '2025-01-10',
        [categoryCol.id]: categoryOptions[1].id, // Transportation
        [statusCol.id]: statusOptions[1].id, // Processed
        [reimbursedCol.id]: true,
        [notesCol.id]: 'Business trip to NYC',
        [receiptCol.id]: [],
        [tagsCol.id]: [tagOptions[1].id, tagOptions[2].id], // Billable, Tax Deductible
        [linkCol.id]: 'https://receipts.uber.com/r/abc123',
        projectIndex: 0, // Marketing Campaign
      },
      {
        [nameCol.id]: 'Team Lunch',
        [vendorCol.id]: 'Chipotle',
        [amountCol.id]: 78.25,
        [dateCol.id]: '2025-01-09',
        [categoryCol.id]: categoryOptions[0].id, // Food & Dining
        [statusCol.id]: statusOptions[0].id, // Pending
        [reimbursedCol.id]: false,
        [notesCol.id]: 'Quarterly team lunch',
        [receiptCol.id]: [],
        [tagsCol.id]: [tagOptions[1].id], // Billable
        [linkCol.id]: 'https://chipotle.com/receipt/xyz789',
        projectIndex: 2, // Q1 Planning
      },
      {
        [nameCol.id]: 'Notion Subscription',
        [vendorCol.id]: 'Notion',
        [amountCol.id]: 10.00,
        [dateCol.id]: '2025-01-08',
        [categoryCol.id]: categoryOptions[3].id, // Software
        [statusCol.id]: statusOptions[1].id, // Processed
        [reimbursedCol.id]: true,
        [notesCol.id]: 'Monthly subscription',
        [receiptCol.id]: [],
        [tagsCol.id]: [tagOptions[2].id, tagOptions[3].id], // Tax Deductible, Recurring
        [linkCol.id]: 'https://notion.so/billing/invoice/2025-01',
        projectIndex: 1, // Website Redesign
      },
      {
        [nameCol.id]: 'Office Printer Paper',
        [vendorCol.id]: 'Staples',
        [amountCol.id]: 35.99,
        [dateCol.id]: '2025-01-07',
        [categoryCol.id]: categoryOptions[2].id, // Office Supplies
        [statusCol.id]: statusOptions[0].id, // Pending
        [reimbursedCol.id]: false,
        [notesCol.id]: '',
        [receiptCol.id]: [],
        [tagsCol.id]: [tagOptions[0].id, tagOptions[2].id], // Urgent, Tax Deductible
        [linkCol.id]: 'https://staples.com/orders/order-456',
        projectIndex: null, // No project
      },
      {
        [nameCol.id]: 'Flight to SF',
        [vendorCol.id]: 'United Airlines',
        [amountCol.id]: 425.00,
        [dateCol.id]: '2025-01-05',
        [categoryCol.id]: categoryOptions[4].id, // Travel
        [statusCol.id]: statusOptions[1].id, // Processed
        [reimbursedCol.id]: true,
        [notesCol.id]: 'Conference attendance',
        [receiptCol.id]: [],
        [tagsCol.id]: [tagOptions[1].id, tagOptions[2].id], // Billable, Tax Deductible
        [linkCol.id]: 'https://united.com/receipt/conf-789',
        projectIndex: 0, // Marketing Campaign
      },
    ];

    // Create receipt rows and relations
    for (const data of sampleData) {
      const { projectIndex, ...cellData } = data;
      const row = await this.createRow({ tableId: receiptsTable.id, cells: cellData });

      // Create relation to project if specified
      if (projectIndex !== null && projectIndex !== undefined) {
        await this.createRelation({
          sourceRowId: row.id,
          sourceColumnId: projectCol.id,
          targetRowId: projectRows[projectIndex].id,
        });
      }
    }

    // =========================================================================
    // Create default views for both tables
    // =========================================================================

    // Default views for Receipts table
    await this.createView({
      tableId: receiptsTable.id,
      name: 'Table',
      type: 'table',
      isDefault: true,
    });

    await this.createView({
      tableId: receiptsTable.id,
      name: 'Board',
      type: 'board',
      config: {
        boardConfig: {
          groupByColumnId: statusCol.id,
        },
      },
    });

    await this.createView({
      tableId: receiptsTable.id,
      name: 'Calendar',
      type: 'calendar',
      config: {
        calendarConfig: {
          dateColumnId: dateCol.id,
        },
      },
    });

    // Default view for Projects table
    await this.createView({
      tableId: projectsTable.id,
      name: 'Table',
      type: 'table',
      isDefault: true,
    });

    return {
      tableId: receiptsTable.id,
      projectsTableId: projectsTable.id,
    };
  }
}

export type { DatabaseAdapter } from '@marlinjai/data-table-core';
