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
import { useDbAdapter } from '../providers/DataTableProvider';

export interface UseRowsOptions {
  tableId: string;
  initialFilters?: QueryFilter[];
  initialSorts?: QuerySort[];
  pageSize?: number;
  includeArchived?: boolean;
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
  addRow: (cells?: Record<string, CellValue>) => Promise<Row>;
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
}: UseRowsOptions): UseRowsResult {
  const dbAdapter = useDbAdapter();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<QueryFilter[]>(initialFilters);
  const [sorts, setSortsState] = useState<QuerySort[]>(initialSorts);
  const offsetRef = useRef(0);

  const fetchRows = useCallback(
    async (append = false) => {
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
    async (cells?: Record<string, CellValue>) => {
      const input: CreateRowInput = { tableId, cells };
      const row = await dbAdapter.createRow(input);
      setRows((prev) => [row, ...prev]);
      setTotal((prev) => prev + 1);
      return row;
    },
    [dbAdapter, tableId]
  );

  const updateRow = useCallback(
    async (rowId: string, cells: Record<string, CellValue>) => {
      const row = await dbAdapter.updateRow(rowId, cells);
      setRows((prev) => prev.map((r) => (r.id === rowId ? row : r)));
      return row;
    },
    [dbAdapter]
  );

  const deleteRow = useCallback(
    async (rowId: string) => {
      await dbAdapter.deleteRow(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setTotal((prev) => prev - 1);
    },
    [dbAdapter]
  );

  const archiveRow = useCallback(
    async (rowId: string) => {
      await dbAdapter.archiveRow(rowId);
      if (!includeArchived) {
        setRows((prev) => prev.filter((r) => r.id !== rowId));
        setTotal((prev) => prev - 1);
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, archived: true } : r))
        );
      }
    },
    [dbAdapter, includeArchived]
  );

  const unarchiveRow = useCallback(
    async (rowId: string) => {
      await dbAdapter.unarchiveRow(rowId);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, archived: false } : r))
      );
    },
    [dbAdapter]
  );

  const bulkDelete = useCallback(
    async (rowIds: string[]) => {
      await dbAdapter.bulkDeleteRows(rowIds);
      setRows((prev) => prev.filter((r) => !rowIds.includes(r.id)));
      setTotal((prev) => prev - rowIds.length);
    },
    [dbAdapter]
  );

  const bulkArchive = useCallback(
    async (rowIds: string[]) => {
      await dbAdapter.bulkArchiveRows(rowIds);
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
    [dbAdapter, includeArchived]
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
