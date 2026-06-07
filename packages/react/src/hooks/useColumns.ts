import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Column,
  CreateColumnInput,
  UpdateColumnInput,
  SelectOption,
  CreateSelectOptionInput,
  UpdateSelectOptionInput,
} from '@marlinjai/data-table-core';
import { useDbAdapter, useActions } from '../providers/DataTableProvider';

export interface UseColumnsOptions {
  tableId: string;
  initialColumns?: Column[];
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

export function useColumns({ tableId, initialColumns }: UseColumnsOptions): UseColumnsResult {
  const dbAdapter = useDbAdapter();
  const actions = useActions();
  const hasInitialColumns = initialColumns !== undefined;
  const [columns, setColumns] = useState<Column[]>(initialColumns ?? []);
  const [isLoading, setIsLoading] = useState(!hasInitialColumns);
  const [error, setError] = useState<Error | null>(null);
  // Track whether we've consumed initialColumns to avoid re-fetching on mount
  const initialDataConsumed = useRef(hasInitialColumns);

  const fetchColumns = useCallback(async () => {
    if (!dbAdapter) {
      // No adapter available — can't fetch
      setIsLoading(false);
      return;
    }
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
    // Skip initial fetch if we already have initialColumns
    if (initialDataConsumed.current) {
      initialDataConsumed.current = false;
      return;
    }
    fetchColumns();
  }, [fetchColumns]);

  const addColumn = useCallback(
    async (input: Omit<CreateColumnInput, 'tableId'>) => {
      const createFn = actions?.createColumn
        ?? (dbAdapter ? (i: CreateColumnInput) => dbAdapter.createColumn(i) : undefined);
      if (!createFn) throw new Error('No createColumn action or dbAdapter available');
      const column = await createFn({ ...input, tableId });
      setColumns((prev) => [...prev, column]);
      return column;
    },
    [actions, dbAdapter, tableId]
  );

  const updateColumn = useCallback(
    async (columnId: string, updates: UpdateColumnInput) => {
      const updateFn = actions?.updateColumn
        ?? (dbAdapter ? (id: string, u: UpdateColumnInput) => dbAdapter.updateColumn(id, u) : undefined);
      // Alignment is UI-only (not persisted by all adapters), so handle it locally
      if (updates.alignment !== undefined) {
        const { alignment, ...apiUpdates } = updates;
        setColumns((prev) =>
          prev.map((c) => (c.id === columnId ? { ...c, alignment } : c))
        );
        // If there are other updates beyond alignment, send them to the API
        if (Object.keys(apiUpdates).length > 0) {
          if (!updateFn) throw new Error('No updateColumn action or dbAdapter available');
          const column = await updateFn(columnId, apiUpdates);
          setColumns((prev) =>
            prev.map((c) => (c.id === columnId ? { ...column, alignment } : c))
          );
          return { ...column, alignment };
        }
        const existing = columns.find((c) => c.id === columnId);
        return existing ? { ...existing, alignment } : existing!;
      }
      if (!updateFn) throw new Error('No updateColumn action or dbAdapter available');
      const column = await updateFn(columnId, updates);
      // Preserve any existing local alignment when API returns
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...column, alignment: c.alignment } : c))
      );
      return column;
    },
    [actions, dbAdapter, columns]
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      const deleteFn = actions?.deleteColumn
        ?? (dbAdapter ? (id: string) => dbAdapter.deleteColumn(id) : undefined);
      if (!deleteFn) throw new Error('No deleteColumn action or dbAdapter available');
      await deleteFn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    },
    [actions, dbAdapter]
  );

  const reorderColumns = useCallback(
    async (columnIds: string[]) => {
      const reorderFn = actions?.reorderColumns
        ?? (dbAdapter ? (tId: string, ids: string[]) => dbAdapter.reorderColumns(tId, ids) : undefined);
      if (!reorderFn) throw new Error('No reorderColumns action or dbAdapter available');
      await reorderFn(tableId, columnIds);
      // Re-fetch to get updated positions (only if adapter available)
      if (dbAdapter) {
        await fetchColumns();
      } else {
        // Reorder local state when no adapter
        setColumns((prev) => {
          const colMap = new Map(prev.map((c) => [c.id, c]));
          return columnIds
            .map((id, index) => {
              const col = colMap.get(id);
              return col ? { ...col, position: index } : null;
            })
            .filter((c): c is Column => c !== null);
        });
      }
    },
    [actions, dbAdapter, tableId, fetchColumns]
  );

  const getSelectOptions = useCallback(
    async (columnId: string) => {
      const getFn = actions?.getSelectOptions
        ?? (dbAdapter ? (id: string) => dbAdapter.getSelectOptions(id) : undefined);
      if (!getFn) throw new Error('No getSelectOptions action or dbAdapter available');
      return getFn(columnId);
    },
    [actions, dbAdapter]
  );

  const addSelectOption = useCallback(
    async (input: Omit<CreateSelectOptionInput, 'columnId'> & { columnId: string }) => {
      const createFn = actions?.createSelectOption
        ?? (dbAdapter ? (i: CreateSelectOptionInput) => dbAdapter.createSelectOption(i) : undefined);
      if (!createFn) throw new Error('No createSelectOption action or dbAdapter available');
      return createFn(input);
    },
    [actions, dbAdapter]
  );

  const updateSelectOption = useCallback(
    async (optionId: string, updates: UpdateSelectOptionInput) => {
      const updateFn = actions?.updateSelectOption
        ?? (dbAdapter ? (id: string, u: UpdateSelectOptionInput) => dbAdapter.updateSelectOption(id, u) : undefined);
      if (!updateFn) throw new Error('No updateSelectOption action or dbAdapter available');
      return updateFn(optionId, updates);
    },
    [actions, dbAdapter]
  );

  const deleteSelectOption = useCallback(
    async (optionId: string) => {
      const deleteFn = actions?.deleteSelectOption
        ?? (dbAdapter ? (id: string) => dbAdapter.deleteSelectOption(id) : undefined);
      if (!deleteFn) throw new Error('No deleteSelectOption action or dbAdapter available');
      await deleteFn(optionId);
    },
    [actions, dbAdapter]
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
