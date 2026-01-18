/**
 * Core types for @marlinjai/data-table
 * Notion-like data table component
 */

// =============================================================================
// Column Types
// =============================================================================

export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'file'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'created_time'
  | 'last_edited_time';

// =============================================================================
// Column Configuration Types
// =============================================================================

export interface TextColumnConfig {
  maxLength?: number;
  placeholder?: string;
}

export interface NumberColumnConfig {
  format: 'number' | 'currency' | 'percent';
  precision?: number;
  min?: number;
  max?: number;
  currencyCode?: string; // e.g., 'USD', 'EUR'
}

export interface DateColumnConfig {
  includeTime?: boolean;
  dateFormat?: string; // e.g., 'YYYY-MM-DD'
  timezone?: string;
}

export interface SelectColumnConfig {
  // Options are stored separately in dt_select_options table
}

export interface MultiSelectColumnConfig {
  maxSelections?: number;
}

export interface UrlColumnConfig {
  showPreview?: boolean;
}

export interface FileColumnConfig {
  allowedTypes?: string[]; // MIME types
  maxFiles?: number;
  maxSizeBytes?: number;
}

export interface FormulaColumnConfig {
  formula: string;
  resultType: 'text' | 'number' | 'date' | 'boolean';
}

export interface RelationColumnConfig {
  targetTableId: string;
  bidirectional?: boolean;
  reverseColumnId?: string; // For bidirectional relations
  limitType?: 'single' | 'multiple';
}

export interface RollupColumnConfig {
  relationColumnId: string;
  targetColumnId: string;
  aggregation: RollupAggregation;
}

export interface CreatedTimeColumnConfig {
  dateFormat?: string; // e.g., 'YYYY-MM-DD HH:mm'
  includeTime?: boolean;
  timezone?: string;
}

export interface LastEditedTimeColumnConfig {
  dateFormat?: string; // e.g., 'YYYY-MM-DD HH:mm'
  includeTime?: boolean;
  timezone?: string;
}

export type RollupAggregation =
  | 'count'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'countValues'
  | 'countUnique'
  | 'countEmpty'
  | 'countNotEmpty'
  | 'percentEmpty'
  | 'percentNotEmpty'
  | 'showOriginal'
  | 'showUnique';

export type ColumnConfig =
  | TextColumnConfig
  | NumberColumnConfig
  | DateColumnConfig
  | SelectColumnConfig
  | MultiSelectColumnConfig
  | UrlColumnConfig
  | FileColumnConfig
  | FormulaColumnConfig
  | RelationColumnConfig
  | RollupColumnConfig
  | CreatedTimeColumnConfig
  | LastEditedTimeColumnConfig;

// =============================================================================
// Core Entities
// =============================================================================

export interface Table {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  tableId: string;
  name: string;
  type: ColumnType;
  position: number;
  width: number;
  isPrimary: boolean;
  config?: ColumnConfig;
  createdAt: Date;
}

export interface SelectOption {
  id: string;
  columnId: string;
  name: string;
  color?: string;
  position: number;
}

export interface Row {
  id: string;
  tableId: string;
  parentRowId?: string; // For sub-items/hierarchical rows
  cells: Record<string, CellValue>;
  computed?: Record<string, CellValue>; // Cached formula/rollup values
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileReference {
  id: string;
  rowId: string;
  columnId: string;
  fileId: string; // External file storage ID
  fileUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes?: number;
  position: number;
  metadata?: Record<string, unknown>; // OCR data, etc.
}

export interface Relation {
  id: string;
  sourceRowId: string;
  sourceColumnId: string;
  targetRowId: string;
  createdAt: Date;
}

// =============================================================================
// Cell Values
// =============================================================================

export type CellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | string[] // For multi_select
  | FileReference[] // For file columns
  | RelationValue[]; // For relation columns

export interface RelationValue {
  rowId: string;
  displayValue?: string; // Cached title of related row
}

// =============================================================================
// Query Types
// =============================================================================

export interface QueryOptions {
  filters?: QueryFilter[];
  sorts?: QuerySort[];
  limit?: number;
  offset?: number;
  cursor?: string;
  includeArchived?: boolean;
  // Sub-items filtering
  parentRowId?: string | null; // null = top-level only, undefined = all, string = children of parent
  includeSubItems?: boolean; // Include all sub-items recursively
}

export interface QueryFilter {
  columnId: string;
  operator: FilterOperator;
  value: CellValue;
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEquals'
  | 'lessThan'
  | 'lessThanOrEquals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isIn'
  | 'isNotIn';

export interface QuerySort {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface QueryResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

// =============================================================================
// Input Types (for creating/updating entities)
// =============================================================================

export interface CreateTableInput {
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface CreateColumnInput {
  tableId: string;
  name: string;
  type: ColumnType;
  position?: number;
  width?: number;
  isPrimary?: boolean;
  config?: ColumnConfig;
}

export interface CreateRowInput {
  tableId: string;
  parentRowId?: string; // For creating sub-items
  cells?: Record<string, CellValue>;
}

export interface CreateSelectOptionInput {
  columnId: string;
  name: string;
  color?: string;
  position?: number;
}

export interface CreateRelationInput {
  sourceRowId: string;
  sourceColumnId: string;
  targetRowId: string;
}

export interface CreateFileRefInput {
  rowId: string;
  columnId: string;
  fileId: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes?: number;
  position?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Update Types
// =============================================================================

export interface UpdateTableInput {
  name?: string;
  description?: string;
  icon?: string;
}

export interface UpdateColumnInput {
  name?: string;
  width?: number;
  config?: ColumnConfig;
}

export interface UpdateSelectOptionInput {
  name?: string;
  color?: string;
  position?: number;
}

// =============================================================================
// View Types
// =============================================================================

export type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list';

export interface View {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  isDefault: boolean;
  position: number;
  config: ViewConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewConfig {
  filters?: QueryFilter[];
  sorts?: QuerySort[];
  groupBy?: string; // columnId for grouping (simple)
  groupConfig?: GroupConfig; // Advanced grouping config
  subItemsConfig?: SubItemsConfig; // Sub-items display options
  hiddenColumns?: string[]; // Column IDs to hide in this view
  columnOrder?: string[]; // Custom column order for this view
  footerConfig?: FooterConfig; // Footer calculations config
  // Type-specific config
  boardConfig?: BoardViewConfig;
  calendarConfig?: CalendarViewConfig;
  galleryConfig?: GalleryViewConfig;
  timelineConfig?: TimelineViewConfig;
  listConfig?: ListViewConfig;
}

export interface GroupConfig {
  columnId: string; // Column to group by
  direction?: 'asc' | 'desc'; // Group sort direction
  hideEmptyGroups?: boolean;
  collapsedGroups?: string[]; // Group values that are collapsed
}

export interface SubItemsConfig {
  enabled: boolean;
  displayMode?: 'nested' | 'flat'; // nested shows hierarchy, flat shows all
  filterMode?: 'all' | 'parents' | 'subitems'; // What to show
  collapsedParents?: string[]; // Parent row IDs that are collapsed
}

export interface BoardViewConfig {
  groupByColumnId: string; // must be select/multi_select
  showEmptyGroups?: boolean;
  cardProperties?: string[]; // columnIds to show on cards
}

export interface CalendarViewConfig {
  dateColumnId: string;
  endDateColumnId?: string; // for ranges
}

export interface GalleryViewConfig {
  coverColumnId?: string; // file column for cover image
  cardSize?: 'small' | 'medium' | 'large';
  cardProperties?: string[]; // columnIds to show on cards
}

export interface TimelineViewConfig {
  startDateColumnId: string;
  endDateColumnId?: string;
  groupByColumnId?: string;
}

export interface ListViewConfig {
  showCheckboxes?: boolean;
  indentColumnId?: string; // for nested lists
}

// =============================================================================
// Footer Calculation Types
// =============================================================================

export type FooterCalculationType =
  | 'none'
  // Counting (available for all column types)
  | 'count'
  | 'count_values'
  | 'count_unique'
  | 'count_empty'
  | 'count_not_empty'
  | 'percent_empty'
  | 'percent_not_empty'
  // Numeric (only for number columns)
  | 'sum'
  | 'average'
  | 'median'
  | 'min'
  | 'max'
  | 'range'
  // Date (only for date, created_time, last_edited_time columns)
  | 'earliest_date'
  | 'latest_date'
  | 'date_range'
  // Boolean (only for boolean/checkbox columns)
  | 'checked'
  | 'unchecked'
  | 'percent_checked'
  | 'percent_unchecked';

export interface FooterConfig {
  calculations: Record<string, FooterCalculationType>; // columnId -> calculation type
}

// =============================================================================
// View Input Types
// =============================================================================

export interface CreateViewInput {
  tableId: string;
  name: string;
  type: ViewType;
  isDefault?: boolean;
  position?: number;
  config?: ViewConfig;
}

export interface UpdateViewInput {
  name?: string;
  type?: ViewType;
  isDefault?: boolean;
  config?: ViewConfig;
}
