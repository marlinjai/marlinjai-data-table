import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Row,
  CreateRowInput,
  QueryOptions,
  QueryResult,
  CellValue,
  QueryFilter,
  QuerySort,
} from '@marlinjai/data-table-core';
import { useDbAdapter, useActions } from '../providers/DataTableProvider';

export interface UseRowsOptions {
  tableId: string;
  initialFilters?: QueryFilter[];
  initialSorts?: QuerySort[];
  pageSize?: number;
  includeArchived?: boolean;
  initialRows?: { items: Row[]; total: number; hasMore: boolean };
}

export interface UseRowsResult {
  rows: Row[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;

  // Filters and sorts
  filters: QueryFilter[];
  sorts: QuerySort[];
  setFilters: (filters: QueryFilter[]) => void;
  setSorts: (sorts: QuerySort[]) => void;
  addFilter: (filter: QueryFilter) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;

  // Row operations
  addRow: (options?: { cells?: Record<string, CellValue>; parentRowId?: string }) => Promise<Row>;
  updateRow: (rowId: string, cells: Record<string, CellValue>) => Promise<Row>;
  deleteRow: (rowId: string) => Promise<void>;
  archiveRow: (rowId: string) => Promise<void>;
  unarchiveRow: (rowId: string) => Promise<void>;

  // Bulk operations
  bulkDelete: (rowIds: string[]) => Promise<void>;
  bulkArchive: (rowIds: string[]) => Promise<void>;

  // Pagination
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRows({
  tableId,
  initialFilters = [],
  initialSorts = [],
  pageSize = 50,
  includeArchived = false,
  initialRows,
}: UseRowsOptions): UseRowsResult {
  const dbAdapter = useDbAdapter();
  const actions = useActions();
  const hasInitialRows = initialRows !== undefined;
  const [rows, setRows] = useState<Row[]>(initialRows?.items ?? []);
  const [total, setTotal] = useState(initialRows?.total ?? 0);
  const [hasMore, setHasMore] = useState(initialRows?.hasMore ?? false);
  const [isLoading, setIsLoading] = useState(!hasInitialRows);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<QueryFilter[]>(initialFilters);
  const [sorts, setSortsState] = useState<QuerySort[]>(initialSorts);
  const offsetRef = useRef(hasInitialRows ? (initialRows?.items.length ?? 0) : 0);
  // Track whether we've consumed initialRows to avoid re-fetching on mount
  const initialDataConsumed = useRef(hasInitialRows);

  const fetchRows = useCallback(
    async (append = false) => {
      if (!dbAdapter) {
        // No adapter available — can't fetch
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);

        const query: QueryOptions = {
          filters,
          sorts,
          limit: pageSize,
          offset: append ? offsetRef.current : 0,
          includeArchived,
        };

        const result: QueryResult<Row> = await dbAdapter.getRows(tableId, query);

        if (append) {
          setRows((prev) => [...prev, ...result.items]);
        } else {
          setRows(result.items);
          offsetRef.current = 0;
        }

        offsetRef.current += result.items.length;
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch rows'));
      } finally {
        setIsLoading(false);
      }
    },
    [dbAdapter, tableId, filters, sorts, pageSize, includeArchived]
  );

  useEffect(() => {
    // Skip initial fetch if we already have initialRows
    if (initialDataConsumed.current) {
      initialDataConsumed.current = false;
      return;
    }
    fetchRows(false);
  }, [fetchRows]);

  const setFilters = useCallback((newFilters: QueryFilter[]) => {
    setFiltersState(newFilters);
    offsetRef.current = 0;
  }, []);

  const setSorts = useCallback((newSorts: QuerySort[]) => {
    setSortsState(newSorts);
    offsetRef.current = 0;
  }, []);

  const addFilter = useCallback((filter: QueryFilter) => {
    setFiltersState((prev) => {
      // Replace existing filter for same column
      const existing = prev.findIndex((f) => f.columnId === filter.columnId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = filter;
        return updated;
      }
      return [...prev, filter];
    });
    offsetRef.current = 0;
  }, []);

  const removeFilter = useCallback((columnId: string) => {
    setFiltersState((prev) => prev.filter((f) => f.columnId !== columnId));
    offsetRef.current = 0;
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState([]);
    offsetRef.current = 0;
  }, []);

  const addRow = useCallback(
    async (options?: { cells?: Record<string, CellValue>; parentRowId?: string }) => {
      const input: CreateRowInput = {
        tableId,
        cells: options?.cells,
        parentRowId: options?.parentRowId,
      };
      const createFn = actions?.createRow
        ?? (dbAdapter ? (i: CreateRowInput) => dbAdapter.createRow(i) : undefined);
      if (!createFn) throw new Error('No createRow action or dbAdapter available');
      const row = await createFn(input);
      // If it's a sub-item, add it after its parent in the list
      if (options?.parentRowId) {
        setRows((prev) => {
          const parentIndex = prev.findIndex((r) => r.id === options.parentRowId);
          if (parentIndex >= 0) {
            const newRows = [...prev];
            newRows.splice(parentIndex + 1, 0, row);
            return newRows;
          }
          return [row, ...prev];
        });
      } else {
        setRows((prev) => [row, ...prev]);
      }
      setTotal((prev) => prev + 1);
      return row;
    },
    [actions, dbAdapter, tableId]
  );

  const updateRow = useCallback(
    async (rowId: string, cells: Record<string, CellValue>) => {
      const updateFn = actions?.updateRow
        ?? (dbAdapter ? (id: string, c: Record<string, CellValue>) => dbAdapter.updateRow(id, c) : undefined);
      if (!updateFn) throw new Error('No updateRow action or dbAdapter available');
      const row = await updateFn(rowId, cells);
      setRows((prev) => prev.map((r) => (r.id === rowId ? row : r)));
      return row;
    },
    [actions, dbAdapter]
  );

  const deleteRow = useCallback(
    async (rowId: string) => {
      const deleteFn = actions?.deleteRow
        ?? (dbAdapter ? (id: string) => dbAdapter.deleteRow(id) : undefined);
      if (!deleteFn) throw new Error('No deleteRow action or dbAdapter available');
      await deleteFn(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setTotal((prev) => prev - 1);
    },
    [actions, dbAdapter]
  );

  const archiveRow = useCallback(
    async (rowId: string) => {
      const archiveFn = actions?.archiveRow
        ?? (dbAdapter ? (id: string) => dbAdapter.archiveRow(id) : undefined);
      if (!archiveFn) throw new Error('No archiveRow action or dbAdapter available');
      await archiveFn(rowId);
      if (!includeArchived) {
        setRows((prev) => prev.filter((r) => r.id !== rowId));
        setTotal((prev) => prev - 1);
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, archived: true } : r))
        );
      }
    },
    [actions, dbAdapter, includeArchived]
  );

  const unarchiveRow = useCallback(
    async (rowId: string) => {
      const unarchiveFn = actions?.unarchiveRow
        ?? (dbAdapter ? (id: string) => dbAdapter.unarchiveRow(id) : undefined);
      if (!unarchiveFn) throw new Error('No unarchiveRow action or dbAdapter available');
      await unarchiveFn(rowId);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, archived: false } : r))
      );
    },
    [actions, dbAdapter]
  );

  const bulkDelete = useCallback(
    async (rowIds: string[]) => {
      const bulkDeleteFn = actions?.bulkDeleteRows
        ?? (dbAdapter ? (ids: string[]) => dbAdapter.bulkDeleteRows(ids) : undefined);
      if (!bulkDeleteFn) throw new Error('No bulkDeleteRows action or dbAdapter available');
      await bulkDeleteFn(rowIds);
      setRows((prev) => prev.filter((r) => !rowIds.includes(r.id)));
      setTotal((prev) => prev - rowIds.length);
    },
    [actions, dbAdapter]
  );

  const bulkArchive = useCallback(
    async (rowIds: string[]) => {
      const bulkArchiveFn = actions?.bulkArchiveRows
        ?? (dbAdapter ? (ids: string[]) => dbAdapter.bulkArchiveRows(ids) : undefined);
      if (!bulkArchiveFn) throw new Error('No bulkArchiveRows action or dbAdapter available');
      await bulkArchiveFn(rowIds);
      if (!includeArchived) {
        setRows((prev) => prev.filter((r) => !rowIds.includes(r.id)));
        setTotal((prev) => prev - rowIds.length);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            rowIds.includes(r.id) ? { ...r, archived: true } : r
          )
        );
      }
    },
    [actions, dbAdapter, includeArchived]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await fetchRows(true);
    }
  }, [fetchRows, hasMore, isLoading]);

  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    await fetchRows(false);
  }, [fetchRows]);

  return {
    rows,
    total,
    hasMore,
    isLoading,
    error,
    filters,
    sorts,
    setFilters,
    setSorts,
    addFilter,
    removeFilter,
    clearFilters,
    addRow,
    updateRow,
    deleteRow,
    archiveRow,
    unarchiveRow,
    bulkDelete,
    bulkArchive,
    loadMore,
    refresh,
  };
}
