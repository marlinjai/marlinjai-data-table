import { useState, useCallback, useEffect } from 'react';
import type { Table, CreateTableInput, UpdateTableInput } from '@marlinjai/data-table-core';
import { useDbAdapter, useWorkspaceId } from '../providers/DataTableProvider';

export interface UseTablesResult {
  tables: Table[];
  isLoading: boolean;
  error: Error | null;

  createTable: (input: Omit<CreateTableInput, 'workspaceId'>) => Promise<Table>;
  updateTable: (tableId: string, updates: UpdateTableInput) => Promise<Table>;
  deleteTable: (tableId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTables(): UseTablesResult {
  const dbAdapter = useDbAdapter();
  const workspaceId = useWorkspaceId();
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTables = useCallback(async () => {
    if (!dbAdapter) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await dbAdapter.listTables(workspaceId);
      setTables(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tables'));
    } finally {
      setIsLoading(false);
    }
  }, [dbAdapter, workspaceId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const createTable = useCallback(
    async (input: Omit<CreateTableInput, 'workspaceId'>) => {
      if (!dbAdapter) throw new Error('No dbAdapter available for createTable');
      const table = await dbAdapter.createTable({ ...input, workspaceId });
      setTables((prev) => [table, ...prev]);
      return table;
    },
    [dbAdapter, workspaceId]
  );

  const updateTable = useCallback(
    async (tableId: string, updates: UpdateTableInput) => {
      if (!dbAdapter) throw new Error('No dbAdapter available for updateTable');
      const table = await dbAdapter.updateTable(tableId, updates);
      setTables((prev) => prev.map((t) => (t.id === tableId ? table : t)));
      return table;
    },
    [dbAdapter]
  );

  const deleteTable = useCallback(
    async (tableId: string) => {
      if (!dbAdapter) throw new Error('No dbAdapter available for deleteTable');
      await dbAdapter.deleteTable(tableId);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
    },
    [dbAdapter]
  );

  return {
    tables,
    isLoading,
    error,
    createTable,
    updateTable,
    deleteTable,
    refresh: fetchTables,
  };
}
