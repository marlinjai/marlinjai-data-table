import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DatabaseAdapter, FileStorageAdapter } from '@marlinjai/data-table-core';
import { NoopFileAdapter } from '@marlinjai/data-table-core';

export interface DataTableConfig {
  /**
   * Database adapter for storing table data
   */
  dbAdapter: DatabaseAdapter;

  /**
   * File storage adapter for file columns (optional)
   */
  fileAdapter?: FileStorageAdapter;

  /**
   * Workspace ID for multi-tenant isolation
   */
  workspaceId: string;
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
  children,
}: DataTableProviderProps) {
  const value = useMemo<DataTableContextValue>(
    () => ({
      dbAdapter,
      fileAdapter: fileAdapter ?? new NoopFileAdapter(),
      workspaceId,
    }),
    [dbAdapter, fileAdapter, workspaceId]
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

export function useDbAdapter(): DatabaseAdapter {
  return useDataTableContext().dbAdapter;
}

export function useFileAdapter(): FileStorageAdapter {
  return useDataTableContext().fileAdapter;
}

export function useWorkspaceId(): string {
  return useDataTableContext().workspaceId;
}
