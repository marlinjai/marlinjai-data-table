import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  DatabaseAdapter,
  FileStorageAdapter,
  Column,
  Row,
  View,
  SelectOption,
  CellValue,
  CreateRowInput,
  CreateColumnInput,
  UpdateColumnInput,
  CreateSelectOptionInput,
  UpdateSelectOptionInput,
  CreateViewInput,
  UpdateViewInput,
  CreateFileRefInput,
  FileReference,
} from '@marlinjai/data-table-core';
import { NoopFileAdapter } from '@marlinjai/data-table-core';

// =============================================================================
// Initial Data — pass pre-fetched data to skip client-side fetches
// =============================================================================

export interface InitialTableData {
  columns?: Column[];
  rows?: { items: Row[]; total: number; hasMore: boolean };
  views?: View[];
  selectOptions?: Record<string, SelectOption[]>; // columnId → options
}

// =============================================================================
// Actions — server action callbacks for mutations
// =============================================================================

export interface DataTableActions {
  // Row mutations
  createRow?: (input: CreateRowInput) => Promise<Row>;
  updateRow?: (rowId: string, cells: Record<string, CellValue>) => Promise<Row>;
  deleteRow?: (rowId: string) => Promise<void>;
  archiveRow?: (rowId: string) => Promise<void>;
  unarchiveRow?: (rowId: string) => Promise<void>;
  bulkDeleteRows?: (rowIds: string[]) => Promise<void>;
  bulkArchiveRows?: (rowIds: string[]) => Promise<void>;
  // Column mutations
  createColumn?: (input: CreateColumnInput) => Promise<Column>;
  updateColumn?: (columnId: string, updates: UpdateColumnInput) => Promise<Column>;
  deleteColumn?: (columnId: string) => Promise<void>;
  reorderColumns?: (tableId: string, columnIds: string[]) => Promise<void>;
  // Select option mutations
  createSelectOption?: (input: CreateSelectOptionInput) => Promise<SelectOption>;
  updateSelectOption?: (optionId: string, updates: UpdateSelectOptionInput) => Promise<SelectOption>;
  deleteSelectOption?: (optionId: string) => Promise<void>;
  getSelectOptions?: (columnId: string) => Promise<SelectOption[]>;
  // View mutations
  createView?: (input: CreateViewInput) => Promise<View>;
  updateView?: (viewId: string, updates: UpdateViewInput) => Promise<View>;
  deleteView?: (viewId: string) => Promise<void>;
  reorderViews?: (tableId: string, viewIds: string[]) => Promise<void>;
  // File mutations
  addFileReference?: (input: CreateFileRefInput) => Promise<FileReference>;
  removeFileReference?: (fileRefId: string) => Promise<void>;
}

// =============================================================================
// Config & Context
// =============================================================================

export interface DataTableConfig {
  /**
   * Database adapter for storing table data.
   * Optional when using initialData + actions (Pattern C).
   */
  dbAdapter?: DatabaseAdapter;

  /**
   * File storage adapter for file columns (optional)
   */
  fileAdapter?: FileStorageAdapter;

  /**
   * Workspace ID for multi-tenant isolation
   */
  workspaceId: string;

  /**
   * Pre-fetched data from server components.
   * When provided, hooks skip their initial client-side fetch.
   */
  initialData?: InitialTableData;

  /**
   * Server action callbacks for mutations.
   * When provided, hooks call these instead of dbAdapter methods.
   */
  actions?: DataTableActions;
}

export interface DataTableContextValue extends DataTableConfig {
  fileAdapter: FileStorageAdapter;
}

const DataTableContext = createContext<DataTableContextValue | null>(null);

export interface DataTableProviderProps extends DataTableConfig {
  children: ReactNode;
}

export function DataTableProvider({
  dbAdapter,
  fileAdapter,
  workspaceId,
  initialData,
  actions,
  children,
}: DataTableProviderProps) {
  const value = useMemo<DataTableContextValue>(
    () => ({
      dbAdapter,
      fileAdapter: fileAdapter ?? new NoopFileAdapter(),
      workspaceId,
      initialData,
      actions,
    }),
    [dbAdapter, fileAdapter, workspaceId, initialData, actions]
  );

  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}

export function useDataTableContext(): DataTableContextValue {
  const context = useContext(DataTableContext);
  if (!context) {
    throw new Error('useDataTableContext must be used within a DataTableProvider');
  }
  return context;
}

export function useDbAdapter(): DatabaseAdapter | undefined {
  return useDataTableContext().dbAdapter;
}

export function useFileAdapter(): FileStorageAdapter {
  return useDataTableContext().fileAdapter;
}

export function useWorkspaceId(): string {
  return useDataTableContext().workspaceId;
}

export function useActions(): DataTableActions | undefined {
  return useDataTableContext().actions;
}

export function useInitialData(): InitialTableData | undefined {
  return useDataTableContext().initialData;
}
