/**
 * Database Adapter Interface
 *
 * This interface defines the contract for database adapters.
 * Implementations can target different databases (D1, Supabase, PostgreSQL, etc.)
 */

import type {
  Table,
  Column,
  Row,
  SelectOption,
  FileReference,
  View,
  QueryOptions,
  QueryResult,
  CreateTableInput,
  CreateColumnInput,
  CreateRowInput,
  CreateSelectOptionInput,
  CreateRelationInput,
  CreateFileRefInput,
  CreateViewInput,
  UpdateTableInput,
  UpdateColumnInput,
  UpdateSelectOptionInput,
  UpdateViewInput,
  CellValue,
} from './types';

export interface DatabaseAdapter {
  // =========================================================================
  // Tables
  // =========================================================================

  /**
   * Create a new table
   */
  createTable(input: CreateTableInput): Promise<Table>;

  /**
   * Get a table by ID
   */
  getTable(tableId: string): Promise<Table | null>;

  /**
   * Update a table
   */
  updateTable(tableId: string, updates: UpdateTableInput): Promise<Table>;

  /**
   * Delete a table and all its data
   */
  deleteTable(tableId: string): Promise<void>;

  /**
   * List all tables in a workspace
   */
  listTables(workspaceId: string): Promise<Table[]>;

  // =========================================================================
  // Columns
  // =========================================================================

  /**
   * Create a new column
   */
  createColumn(input: CreateColumnInput): Promise<Column>;

  /**
   * Get all columns for a table
   */
  getColumns(tableId: string): Promise<Column[]>;

  /**
   * Get a column by ID
   */
  getColumn(columnId: string): Promise<Column | null>;

  /**
   * Update a column
   */
  updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column>;

  /**
   * Delete a column
   */
  deleteColumn(columnId: string): Promise<void>;

  /**
   * Reorder columns
   */
  reorderColumns(tableId: string, columnIds: string[]): Promise<void>;

  // =========================================================================
  // Select Options (for select/multi_select columns)
  // =========================================================================

  /**
   * Create a select option
   */
  createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption>;

  /**
   * Get all options for a column
   */
  getSelectOptions(columnId: string): Promise<SelectOption[]>;

  /**
   * Update a select option
   */
  updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption>;

  /**
   * Delete a select option
   */
  deleteSelectOption(optionId: string): Promise<void>;

  /**
   * Reorder select options
   */
  reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void>;

  // =========================================================================
  // Rows
  // =========================================================================

  /**
   * Create a new row
   */
  createRow(input: CreateRowInput): Promise<Row>;

  /**
   * Get a row by ID
   */
  getRow(rowId: string): Promise<Row | null>;

  /**
   * Get rows with filtering, sorting, and pagination
   */
  getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>>;

  /**
   * Update row cells
   */
  updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row>;

  /**
   * Delete a row permanently
   */
  deleteRow(rowId: string): Promise<void>;

  /**
   * Archive a row (soft delete)
   */
  archiveRow(rowId: string): Promise<void>;

  /**
   * Unarchive a row
   */
  unarchiveRow(rowId: string): Promise<void>;

  /**
   * Bulk create rows
   */
  bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]>;

  /**
   * Bulk delete rows
   */
  bulkDeleteRows(rowIds: string[]): Promise<void>;

  /**
   * Bulk archive rows
   */
  bulkArchiveRows(rowIds: string[]): Promise<void>;

  // =========================================================================
  // Relations
  // =========================================================================

  /**
   * Create a relation between rows
   */
  createRelation(input: CreateRelationInput): Promise<void>;

  /**
   * Delete a relation
   */
  deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void>;

  /**
   * Get all related rows for a row/column
   */
  getRelatedRows(rowId: string, columnId: string): Promise<Row[]>;

  /**
   * Get all relations for a row
   */
  getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>>;

  // =========================================================================
  // File References
  // =========================================================================

  /**
   * Add a file reference to a cell
   */
  addFileReference(input: CreateFileRefInput): Promise<FileReference>;

  /**
   * Remove a file reference
   */
  removeFileReference(fileRefId: string): Promise<void>;

  /**
   * Get all file references for a cell
   */
  getFileReferences(rowId: string, columnId: string): Promise<FileReference[]>;

  /**
   * Reorder file references
   */
  reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void>;

  // =========================================================================
  // Views
  // =========================================================================

  /**
   * Create a new view
   */
  createView(input: CreateViewInput): Promise<View>;

  /**
   * Get all views for a table
   */
  getViews(tableId: string): Promise<View[]>;

  /**
   * Get a view by ID
   */
  getView(viewId: string): Promise<View | null>;

  /**
   * Update a view
   */
  updateView(viewId: string, updates: UpdateViewInput): Promise<View>;

  /**
   * Delete a view
   */
  deleteView(viewId: string): Promise<void>;

  /**
   * Reorder views
   */
  reorderViews(tableId: string, viewIds: string[]): Promise<void>;

  // =========================================================================
  // Transactions
  // =========================================================================

  /**
   * Execute operations within a transaction
   */
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
}

/**
 * Abstract base class with common utilities
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  abstract createTable(input: CreateTableInput): Promise<Table>;
  abstract getTable(tableId: string): Promise<Table | null>;
  abstract updateTable(tableId: string, updates: UpdateTableInput): Promise<Table>;
  abstract deleteTable(tableId: string): Promise<void>;
  abstract listTables(workspaceId: string): Promise<Table[]>;

  abstract createColumn(input: CreateColumnInput): Promise<Column>;
  abstract getColumns(tableId: string): Promise<Column[]>;
  abstract getColumn(columnId: string): Promise<Column | null>;
  abstract updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column>;
  abstract deleteColumn(columnId: string): Promise<void>;
  abstract reorderColumns(tableId: string, columnIds: string[]): Promise<void>;

  abstract createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption>;
  abstract getSelectOptions(columnId: string): Promise<SelectOption[]>;
  abstract updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption>;
  abstract deleteSelectOption(optionId: string): Promise<void>;
  abstract reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void>;

  abstract createRow(input: CreateRowInput): Promise<Row>;
  abstract getRow(rowId: string): Promise<Row | null>;
  abstract getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>>;
  abstract updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row>;
  abstract deleteRow(rowId: string): Promise<void>;
  abstract archiveRow(rowId: string): Promise<void>;
  abstract unarchiveRow(rowId: string): Promise<void>;
  abstract bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]>;
  abstract bulkDeleteRows(rowIds: string[]): Promise<void>;
  abstract bulkArchiveRows(rowIds: string[]): Promise<void>;

  abstract createRelation(input: CreateRelationInput): Promise<void>;
  abstract deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void>;
  abstract getRelatedRows(rowId: string, columnId: string): Promise<Row[]>;
  abstract getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>>;

  abstract addFileReference(input: CreateFileRefInput): Promise<FileReference>;
  abstract removeFileReference(fileRefId: string): Promise<void>;
  abstract getFileReferences(rowId: string, columnId: string): Promise<FileReference[]>;
  abstract reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void>;

  abstract createView(input: CreateViewInput): Promise<View>;
  abstract getViews(tableId: string): Promise<View[]>;
  abstract getView(viewId: string): Promise<View | null>;
  abstract updateView(viewId: string, updates: UpdateViewInput): Promise<View>;
  abstract deleteView(viewId: string): Promise<void>;
  abstract reorderViews(tableId: string, viewIds: string[]): Promise<void>;

  abstract transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }
}
