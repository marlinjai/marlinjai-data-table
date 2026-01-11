import { useState, useCallback, useEffect } from 'react';
import type {
  Column,
  CreateColumnInput,
  UpdateColumnInput,
  SelectOption,
  CreateSelectOptionInput,
  UpdateSelectOptionInput,
} from '@marlinjai/data-table-core';
import { useDbAdapter } from '../providers/DataTableProvider';

export interface UseColumnsOptions {
  tableId: string;
}

export interface UseColumnsResult {
  columns: Column[];
  isLoading: boolean;
  error: Error | null;

  // Column operations
  addColumn: (input: Omit<CreateColumnInput, 'tableId'>) => Promise<Column>;
  updateColumn: (columnId: string, updates: UpdateColumnInput) => Promise<Column>;
  deleteColumn: (columnId: string) => Promise<void>;
  reorderColumns: (columnIds: string[]) => Promise<void>;

  // Select options
  getSelectOptions: (columnId: string) => Promise<SelectOption[]>;
  addSelectOption: (input: Omit<CreateSelectOptionInput, 'columnId'> & { columnId: string }) => Promise<SelectOption>;
  updateSelectOption: (optionId: string, updates: UpdateSelectOptionInput) => Promise<SelectOption>;
  deleteSelectOption: (optionId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useColumns({ tableId }: UseColumnsOptions): UseColumnsResult {
  const dbAdapter = useDbAdapter();
  const [columns, setColumns] = useState<Column[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchColumns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await dbAdapter.getColumns(tableId);
      setColumns(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch columns'));
    } finally {
      setIsLoading(false);
    }
  }, [dbAdapter, tableId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const addColumn = useCallback(
    async (input: Omit<CreateColumnInput, 'tableId'>) => {
      const column = await dbAdapter.createColumn({ ...input, tableId });
      setColumns((prev) => [...prev, column]);
      return column;
    },
    [dbAdapter, tableId]
  );

  const updateColumn = useCallback(
    async (columnId: string, updates: UpdateColumnInput) => {
      const column = await dbAdapter.updateColumn(columnId, updates);
      setColumns((prev) => prev.map((c) => (c.id === columnId ? column : c)));
      return column;
    },
    [dbAdapter]
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      await dbAdapter.deleteColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    },
    [dbAdapter]
  );

  const reorderColumns = useCallback(
    async (columnIds: string[]) => {
      await dbAdapter.reorderColumns(tableId, columnIds);
      // Re-fetch to get updated positions
      await fetchColumns();
    },
    [dbAdapter, tableId, fetchColumns]
  );

  const getSelectOptions = useCallback(
    async (columnId: string) => {
      return dbAdapter.getSelectOptions(columnId);
    },
    [dbAdapter]
  );

  const addSelectOption = useCallback(
    async (input: Omit<CreateSelectOptionInput, 'columnId'> & { columnId: string }) => {
      return dbAdapter.createSelectOption(input);
    },
    [dbAdapter]
  );

  const updateSelectOption = useCallback(
    async (optionId: string, updates: UpdateSelectOptionInput) => {
      return dbAdapter.updateSelectOption(optionId, updates);
    },
    [dbAdapter]
  );

  const deleteSelectOption = useCallback(
    async (optionId: string) => {
      await dbAdapter.deleteSelectOption(optionId);
    },
    [dbAdapter]
  );

  return {
    columns,
    isLoading,
    error,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    getSelectOptions,
    addSelectOption,
    updateSelectOption,
    deleteSelectOption,
    refresh: fetchColumns,
  };
}
