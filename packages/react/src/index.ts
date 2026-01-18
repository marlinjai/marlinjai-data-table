/**
 * @marlinjai/data-table-react
 *
 * React components for Notion-like data tables
 */

// Provider
export {
  DataTableProvider,
  useDataTableContext,
  useDbAdapter,
  useFileAdapter,
  useWorkspaceId,
  type DataTableProviderProps,
  type DataTableConfig,
  type DataTableContextValue,
} from './providers/DataTableProvider';

// Hooks
export * from './hooks';

// Components
export * from './components';

// Re-export types from core for convenience
export type {
  Table,
  Column,
  Row,
  SelectOption,
  FileReference,
  CellValue,
  ColumnType,
  ColumnConfig,
  QueryFilter,
  QuerySort,
  QueryOptions,
  QueryResult,
  FilterOperator,
  CreateTableInput,
  CreateColumnInput,
  CreateRowInput,
  UpdateTableInput,
  UpdateColumnInput,
  SubItemsConfig,
  GroupConfig,
} from '@marlinjai/data-table-core';
