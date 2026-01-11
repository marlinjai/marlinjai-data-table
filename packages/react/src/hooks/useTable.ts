import { useState, useCallback, useEffect } from 'react';
import type {
  Table,
  Column,
  Row,
  UpdateTableInput,
  CreateColumnInput,
  UpdateColumnInput,
  CellValue,
  QueryFilter,
  QuerySort,
  SelectOption,
  FileReference,
} from '@marlinjai/data-table-core';
import { useDbAdapter, useWorkspaceId, useFileAdapter } from '../providers/DataTableProvider';
import { useColumns } from './useColumns';
import { useRows } from './useRows';

export interface UseTableOptions {
  tableId: string;
  initialFilters?: QueryFilter[];
  initialSorts?: QuerySort[];
  pageSize?: number;
  includeArchived?: boolean;
}

export interface UseTableResult {
  // Table
  table: Table | null;
  isTableLoading: boolean;
  tableError: Error | null;
  updateTable: (updates: UpdateTableInput) => Promise<Table>;

  // Columns
  columns: Column[];
  isColumnsLoading: boolean;
  columnsError: Error | null;
  addColumn: (input: Omit<CreateColumnInput, 'tableId'>) => Promise<Column>;
  updateColumn: (columnId: string, updates: UpdateColumnInput) => Promise<Column>;
  deleteColumn: (columnId: string) => Promise<void>;
  reorderColumns: (columnIds: string[]) => Promise<void>;

  // Select options
  selectOptions: Map<string, SelectOption[]>;
  loadSelectOptions: (columnId: string) => Promise<void>;
  createSelectOption: (columnId: string, name: string, color?: string) => Promise<SelectOption>;
  updateSelectOption: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  deleteSelectOption: (columnId: string, optionId: string) => Promise<void>;

  // Rows
  rows: Row[];
  total: number;
  hasMore: boolean;
  isRowsLoading: boolean;
  rowsError: Error | null;
  addRow: (cells?: Record<string, CellValue>) => Promise<Row>;
  updateRow: (rowId: string, cells: Record<string, CellValue>) => Promise<Row>;
  deleteRow: (rowId: string) => Promise<void>;
  archiveRow: (rowId: string) => Promise<void>;

  // Cell update helper
  updateCell: (rowId: string, columnId: string, value: CellValue) => Promise<Row>;

  // Filters and sorts
  filters: QueryFilter[];
  sorts: QuerySort[];
  setFilters: (filters: QueryFilter[]) => void;
  setSorts: (sorts: QuerySort[]) => void;
  addFilter: (filter: QueryFilter) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;

  // Pagination
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // File operations
  uploadFile: (rowId: string, columnId: string, file: File) => Promise<FileReference>;
  deleteFile: (rowId: string, columnId: string, fileId: string) => Promise<void>;
}

export function useTable({
  tableId,
  initialFilters = [],
  initialSorts = [],
  pageSize = 50,
  includeArchived = false,
}: UseTableOptions): UseTableResult {
  const dbAdapter = useDbAdapter();
  const fileAdapter = useFileAdapter();

  // Table state
  const [table, setTable] = useState<Table | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [tableError, setTableError] = useState<Error | null>(null);

  // Select options cache
  const [selectOptions, setSelectOptions] = useState<Map<string, SelectOption[]>>(
    new Map()
  );

  // Use column and row hooks
  const columnsHook = useColumns({ tableId });
  const rowsHook = useRows({
    tableId,
    initialFilters,
    initialSorts,
    pageSize,
    includeArchived,
  });

  // Fetch table
  useEffect(() => {
    const fetchTable = async () => {
      try {
        setIsTableLoading(true);
        setTableError(null);
        const result = await dbAdapter.getTable(tableId);
        setTable(result);
      } catch (err) {
        setTableError(err instanceof Error ? err : new Error('Failed to fetch table'));
      } finally {
        setIsTableLoading(false);
      }
    };

    fetchTable();
  }, [dbAdapter, tableId]);

  // Load select options for select/multi_select columns
  useEffect(() => {
    const loadOptions = async () => {
      const selectColumns = columnsHook.columns.filter(
        (c) => c.type === 'select' || c.type === 'multi_select'
      );

      for (const column of selectColumns) {
        if (!selectOptions.has(column.id)) {
          const options = await dbAdapter.getSelectOptions(column.id);
          setSelectOptions((prev) => new Map(prev).set(column.id, options));
        }
      }
    };

    if (columnsHook.columns.length > 0) {
      loadOptions();
    }
  }, [dbAdapter, columnsHook.columns, selectOptions]);

  const updateTable = useCallback(
    async (updates: UpdateTableInput) => {
      const updated = await dbAdapter.updateTable(tableId, updates);
      setTable(updated);
      return updated;
    },
    [dbAdapter, tableId]
  );

  const loadSelectOptions = useCallback(
    async (columnId: string) => {
      const options = await dbAdapter.getSelectOptions(columnId);
      setSelectOptions((prev) => new Map(prev).set(columnId, options));
    },
    [dbAdapter]
  );

  const createSelectOption = useCallback(
    async (columnId: string, name: string, color?: string) => {
      const option = await dbAdapter.createSelectOption({
        columnId,
        name,
        color,
      });
      // Update local cache
      setSelectOptions((prev) => {
        const existing = prev.get(columnId) ?? [];
        return new Map(prev).set(columnId, [...existing, option]);
      });
      return option;
    },
    [dbAdapter]
  );

  const updateSelectOption = useCallback(
    async (optionId: string, updates: { name?: string; color?: string }) => {
      const option = await dbAdapter.updateSelectOption(optionId, updates);
      // Update local cache
      setSelectOptions((prev) => {
        const newMap = new Map(prev);
        for (const [columnId, options] of newMap) {
          const idx = options.findIndex((o) => o.id === optionId);
          if (idx !== -1) {
            const newOptions = [...options];
            newOptions[idx] = option;
            newMap.set(columnId, newOptions);
            break;
          }
        }
        return newMap;
      });
      return option;
    },
    [dbAdapter]
  );

  const deleteSelectOption = useCallback(
    async (columnId: string, optionId: string) => {
      await dbAdapter.deleteSelectOption(optionId);
      // Update local cache
      setSelectOptions((prev) => {
        const existing = prev.get(columnId) ?? [];
        return new Map(prev).set(
          columnId,
          existing.filter((o) => o.id !== optionId)
        );
      });
    },
    [dbAdapter]
  );

  const updateCell = useCallback(
    async (rowId: string, columnId: string, value: CellValue) => {
      return rowsHook.updateRow(rowId, { [columnId]: value });
    },
    [rowsHook]
  );

  const refresh = useCallback(async () => {
    await Promise.all([columnsHook.refresh(), rowsHook.refresh()]);
  }, [columnsHook, rowsHook]);

  // File operations
  const uploadFile = useCallback(
    async (rowId: string, columnId: string, file: File): Promise<FileReference> => {
      // Upload file via file adapter
      const uploaded = await fileAdapter.upload(file);

      // Create file reference
      const fileRef: FileReference = {
        id: uploaded.id + '-' + Date.now(), // Unique reference ID
        rowId,
        columnId,
        fileId: uploaded.id,
        fileUrl: uploaded.url,
        originalName: uploaded.originalName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        position: 0,
        metadata: uploaded.metadata,
      };

      // Get current row to update file list
      const row = rowsHook.rows.find((r) => r.id === rowId);
      const currentFiles = (row?.cells[columnId] as FileReference[] | null) ?? [];

      // Set position based on existing files
      fileRef.position = currentFiles.length;

      // Update row with new file reference
      const newFiles = [...currentFiles, fileRef];
      await rowsHook.updateRow(rowId, { [columnId]: newFiles });

      // Store file reference in database (if adapter supports it)
      if (dbAdapter.addFileReference) {
        await dbAdapter.addFileReference({
          rowId,
          columnId,
          fileId: uploaded.id,
          fileUrl: uploaded.url,
          originalName: uploaded.originalName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          position: fileRef.position,
          metadata: uploaded.metadata,
        });
      }

      return fileRef;
    },
    [fileAdapter, dbAdapter, rowsHook]
  );

  const deleteFile = useCallback(
    async (rowId: string, columnId: string, fileId: string): Promise<void> => {
      // Get current row
      const row = rowsHook.rows.find((r) => r.id === rowId);
      const currentFiles = (row?.cells[columnId] as FileReference[] | null) ?? [];

      // Find the file reference
      const fileRef = currentFiles.find((f) => f.fileId === fileId);
      if (!fileRef) return;

      // Delete from file storage
      await fileAdapter.delete(fileId);

      // Remove from database (if adapter supports it)
      if (dbAdapter.removeFileReference) {
        await dbAdapter.removeFileReference(fileRef.id);
      }

      // Update row with file removed
      const newFiles = currentFiles.filter((f) => f.fileId !== fileId);
      await rowsHook.updateRow(rowId, { [columnId]: newFiles });
    },
    [fileAdapter, dbAdapter, rowsHook]
  );

  return {
    // Table
    table,
    isTableLoading,
    tableError,
    updateTable,

    // Columns
    columns: columnsHook.columns,
    isColumnsLoading: columnsHook.isLoading,
    columnsError: columnsHook.error,
    addColumn: columnsHook.addColumn,
    updateColumn: columnsHook.updateColumn,
    deleteColumn: columnsHook.deleteColumn,
    reorderColumns: columnsHook.reorderColumns,

    // Select options
    selectOptions,
    loadSelectOptions,
    createSelectOption,
    updateSelectOption,
    deleteSelectOption,

    // Rows
    rows: rowsHook.rows,
    total: rowsHook.total,
    hasMore: rowsHook.hasMore,
    isRowsLoading: rowsHook.isLoading,
    rowsError: rowsHook.error,
    addRow: rowsHook.addRow,
    updateRow: rowsHook.updateRow,
    deleteRow: rowsHook.deleteRow,
    archiveRow: rowsHook.archiveRow,

    // Cell update helper
    updateCell,

    // Filters and sorts
    filters: rowsHook.filters,
    sorts: rowsHook.sorts,
    setFilters: rowsHook.setFilters,
    setSorts: rowsHook.setSorts,
    addFilter: rowsHook.addFilter,
    removeFilter: rowsHook.removeFilter,
    clearFilters: rowsHook.clearFilters,

    // Pagination
    loadMore: rowsHook.loadMore,
    refresh,

    // File operations
    uploadFile,
    deleteFile,
  };
}
