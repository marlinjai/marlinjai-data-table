---
title: API Reference
description: Hooks, components, and type definitions
order: 2
---

# API Reference

## Hooks

### useTable

The main hook for interacting with a table.

```typescript
const {
  table,
  columns,
  rows,
  total,
  hasMore,
  isLoading,
  isRowsLoading,
  selectOptions,
  filters,
  sorts,
  setFilters,
  setSorts,
  updateCell,
  updateColumn,
  addColumn,
  deleteColumn,
  addRow,
  deleteRow,
  loadMore,
  loadSelectOptions,
  createSelectOption,
  updateSelectOption,
  deleteSelectOption,
} = useTable({ tableId: string });
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `tableId` | `string` | The ID of the table to load |

#### Return Values

| Name | Type | Description |
|------|------|-------------|
| `table` | `Table \| null` | Table metadata |
| `columns` | `Column[]` | Column definitions |
| `rows` | `Row[]` | Row data |
| `total` | `number` | Total row count |
| `hasMore` | `boolean` | Whether more rows can be loaded |
| `isLoading` | `boolean` | Initial loading state |
| `isRowsLoading` | `boolean` | Loading state for row fetching |
| `selectOptions` | `Map<string, SelectOption[]>` | Options by column ID |
| `filters` | `QueryFilter[]` | Active filters |
| `sorts` | `QuerySort[]` | Active sorts |
| `setFilters` | `(filters: QueryFilter[]) => void` | Update filters |
| `setSorts` | `(sorts: QuerySort[]) => void` | Update sorts |
| `updateCell` | `(rowId, columnId, value) => Promise` | Update a cell |
| `updateColumn` | `(columnId, updates) => Promise` | Update column metadata |
| `addColumn` | `(input) => Promise<Column>` | Add a new column |
| `deleteColumn` | `(columnId) => Promise` | Delete a column |
| `addRow` | `(cells?) => Promise<Row>` | Add a new row |
| `deleteRow` | `(rowId) => Promise` | Delete a row |
| `loadMore` | `() => Promise` | Load more rows (pagination) |
| `loadSelectOptions` | `(columnId) => Promise` | Load select options |
| `createSelectOption` | `(columnId, name, color?) => Promise` | Create option |
| `updateSelectOption` | `(optionId, updates) => Promise` | Update option |
| `deleteSelectOption` | `(columnId, optionId) => Promise` | Delete option |

---

## Components

### DataTableProvider

Context provider that supplies the database adapter.

```tsx
<DataTableProvider
  dbAdapter={adapter}
  workspaceId="my-workspace"
  fileAdapter={fileAdapter}  // Optional
>
  {children}
</DataTableProvider>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dbAdapter` | `DatabaseAdapter` | Yes | Database adapter instance |
| `workspaceId` | `string` | Yes | Workspace/tenant ID |
| `fileAdapter` | `FileStorageAdapter` | No | File storage adapter |
| `children` | `ReactNode` | Yes | Child components |

---

### TableView

The main table component.

```tsx
<TableView
  columns={columns}
  rows={rows}
  selectOptions={selectOptions}
  onCellChange={(rowId, columnId, value) => {}}
  onAddRow={() => {}}
  onDeleteRow={(rowId) => {}}
  onColumnResize={(columnId, width) => {}}
  onAddProperty={(name, type) => {}}
  onCreateSelectOption={(columnId, name, color) => {}}
  onUpdateSelectOption={(optionId, updates) => {}}
  onDeleteSelectOption={(columnId, optionId) => {}}
  sorts={sorts}
  onSortChange={(sorts) => {}}
  selectedRows={selectedRows}
  onSelectionChange={(selection) => {}}
  isLoading={isLoading}
  hasMore={hasMore}
  onLoadMore={() => {}}
  className=""
  style={{}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column[]` | Yes | Column definitions |
| `rows` | `Row[]` | Yes | Row data |
| `selectOptions` | `Map<string, SelectOption[]>` | No | Select options by column |
| `onCellChange` | `(rowId, colId, value) => void` | Yes | Cell change handler |
| `onAddRow` | `() => void` | No | Add row handler |
| `onDeleteRow` | `(rowId) => void` | No | Delete row handler |
| `onColumnResize` | `(colId, width) => void` | No | Column resize handler |
| `onAddProperty` | `(name, type) => void` | No | Add column handler |
| `sorts` | `QuerySort[]` | No | Active sorts |
| `onSortChange` | `(sorts) => void` | No | Sort change handler |
| `selectedRows` | `Set<string>` | No | Selected row IDs |
| `onSelectionChange` | `(selection) => void` | No | Selection handler |
| `isLoading` | `boolean` | No | Loading state |
| `hasMore` | `boolean` | No | Has more rows |
| `onLoadMore` | `() => void` | No | Load more handler |
| `className` | `string` | No | Custom CSS class |
| `style` | `CSSProperties` | No | Inline styles |

---

### FilterBar

Filter controls for the table.

```tsx
<FilterBar
  columns={columns}
  filters={filters}
  selectOptions={selectOptions}
  onFiltersChange={(filters) => {}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column[]` | Yes | Column definitions |
| `filters` | `QueryFilter[]` | Yes | Active filters |
| `selectOptions` | `Map<string, SelectOption[]>` | No | For select column filters |
| `onFiltersChange` | `(filters) => void` | Yes | Filter change handler |

---

## Types

### Column

```typescript
interface Column {
  id: string;
  tableId: string;
  name: string;
  type: ColumnType;
  position: number;
  width: number;
  isPrimary: boolean;
  config?: Record<string, unknown>;
}
```

### ColumnType

```typescript
type ColumnType =
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
  | 'rollup';
```

### Row

```typescript
interface Row {
  id: string;
  tableId: string;
  cells: Record<string, CellValue>;
}
```

### CellValue

```typescript
type CellValue =
  | string
  | number
  | boolean
  | string[]  // multi_select
  | null;
```

### SelectOption

```typescript
interface SelectOption {
  id: string;
  columnId: string;
  name: string;
  color?: string;
  position: number;
}
```

### QueryFilter

```typescript
interface QueryFilter {
  columnId: string;
  operator: FilterOperator;
  value: CellValue;
}

type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'isEmpty'
  | 'isNotEmpty';
```

### QuerySort

```typescript
interface QuerySort {
  columnId: string;
  direction: 'asc' | 'desc';
}
```

### useViews

Hook for managing table views.

```typescript
const {
  views,
  currentView,
  isLoading,
  error,
  createView,
  updateView,
  deleteView,
  reorderViews,
  setCurrentView,
  refresh,
} = useViews({ tableId: string });
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `tableId` | `string` | The ID of the table to manage views for |

#### Return Values

| Name | Type | Description |
|------|------|-------------|
| `views` | `View[]` | Array of all views for the table |
| `currentView` | `View \| null` | The currently selected view |
| `isLoading` | `boolean` | Loading state during initial fetch |
| `error` | `Error \| null` | Error if view fetching failed |
| `createView` | `(input: Omit<CreateViewInput, 'tableId'>) => Promise<View>` | Create a new view |
| `updateView` | `(viewId: string, updates: UpdateViewInput) => Promise<View>` | Update an existing view |
| `deleteView` | `(viewId: string) => Promise<void>` | Delete a view |
| `reorderViews` | `(viewIds: string[]) => Promise<void>` | Reorder views by position |
| `setCurrentView` | `(viewId: string) => void` | Set the current active view |
| `refresh` | `() => Promise<void>` | Manually refresh views from database |

---

## Components

### DataTableProvider

Context provider that supplies the database adapter.

```tsx
<DataTableProvider
  dbAdapter={adapter}
  workspaceId="my-workspace"
  fileAdapter={fileAdapter}  // Optional
>
  {children}
</DataTableProvider>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dbAdapter` | `DatabaseAdapter` | Yes | Database adapter instance |
| `workspaceId` | `string` | Yes | Workspace/tenant ID |
| `fileAdapter` | `FileStorageAdapter` | No | File storage adapter |
| `children` | `ReactNode` | Yes | Child components |

---

### ViewSwitcher

Tab-based view switcher component for navigating between different views of a table.

```tsx
<ViewSwitcher
  views={views}
  currentViewId={currentViewId}
  onViewChange={(viewId) => {}}
  onCreateView={(type) => {}}
  onDeleteView={(viewId) => {}}
  onRenameView={(viewId, name) => {}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `views` | `View[]` | Yes | Array of views to display |
| `currentViewId` | `string \| null` | Yes | ID of the currently active view |
| `onViewChange` | `(viewId: string) => void` | Yes | Callback when view is selected |
| `onCreateView` | `(type: ViewType) => void` | Yes | Callback to create a new view |
| `onDeleteView` | `(viewId: string) => void` | Yes | Callback to delete a view |
| `onRenameView` | `(viewId: string, name: string) => void` | Yes | Callback to rename a view |

---

### BoardView

Kanban-style board view component for visualizing data grouped by a select column.

```tsx
<BoardView
  columns={columns}
  rows={rows}
  selectOptions={selectOptions}
  config={boardConfig}
  onCellChange={(rowId, columnId, value) => {}}
  onAddRow={(initialCells) => {}}
  onDeleteRow={(rowId) => {}}
  onCardClick={(rowId) => {}}
  onCreateSelectOption={(columnId, name, color) => {}}
  onUpdateSelectOption={(optionId, updates) => {}}
  onDeleteSelectOption={(columnId, optionId) => {}}
  onUploadFile={(rowId, columnId, file) => {}}
  onDeleteFile={(rowId, columnId, fileId) => {}}
  readOnly={false}
  isLoading={false}
  className=""
  style={{}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column[]` | Yes | Column definitions |
| `rows` | `Row[]` | Yes | Row data |
| `selectOptions` | `Map<string, SelectOption[]>` | No | Select options by column ID |
| `config` | `BoardViewConfig` | Yes | Board view configuration |
| `onCellChange` | `(rowId, colId, value) => void` | No | Cell change handler (for drag-drop) |
| `onAddRow` | `(initialCells?) => void` | No | Add row handler with initial values |
| `onDeleteRow` | `(rowId) => void` | No | Delete row handler |
| `onCardClick` | `(rowId) => void` | No | Card click handler |
| `onCreateSelectOption` | `(columnId, name, color?) => Promise` | No | Create select option |
| `onUpdateSelectOption` | `(optionId, updates) => Promise` | No | Update select option |
| `onDeleteSelectOption` | `(columnId, optionId) => Promise` | No | Delete select option |
| `onUploadFile` | `(rowId, columnId, file) => Promise` | No | File upload handler |
| `onDeleteFile` | `(rowId, columnId, fileId) => Promise` | No | File delete handler |
| `readOnly` | `boolean` | No | Disable editing and drag-drop |
| `isLoading` | `boolean` | No | Show loading overlay |
| `className` | `string` | No | Custom CSS class |
| `style` | `CSSProperties` | No | Inline styles |

---

### CalendarView

Calendar view component for displaying rows with date values on a monthly calendar.

```tsx
<CalendarView
  rows={rows}
  columns={columns}
  config={calendarConfig}
  onRowClick={(row) => {}}
  onDayClick={(date, events) => {}}
  onDateChange={(date) => {}}
  isLoading={false}
  className=""
  style={{}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rows` | `Row[]` | Yes | Row data containing date values |
| `columns` | `Column[]` | Yes | Column definitions |
| `config` | `CalendarViewConfig` | Yes | Calendar view configuration |
| `onRowClick` | `(row: Row) => void` | No | Handler when clicking an event |
| `onDayClick` | `(date: Date, events: CalendarEvent[]) => void` | No | Handler when clicking a day |
| `onDateChange` | `(date: Date) => void` | No | Handler when navigating months |
| `isLoading` | `boolean` | No | Show loading state |
| `className` | `string` | No | Custom CSS class |
| `style` | `CSSProperties` | No | Inline styles |

---

### RelationCell

Cell component for displaying and editing relation values.

```tsx
<RelationCell
  value={relationValues}
  onChange={(values) => {}}
  config={relationConfig}
  readOnly={false}
  onSearchRows={(tableId, query) => {}}
  onGetRowTitle={(tableId, rowId) => {}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `RelationValue[] \| null` | Yes | Current relation values |
| `onChange` | `(value: RelationValue[]) => void` | Yes | Handler for value changes |
| `config` | `RelationColumnConfig` | Yes | Relation column configuration |
| `readOnly` | `boolean` | No | Disable editing |
| `onSearchRows` | `(tableId: string, query: string) => Promise<Row[]>` | No | Callback to search rows in target table |
| `onGetRowTitle` | `(tableId: string, rowId: string) => Promise<string>` | No | Callback to get display title for a row |

---

### RelationPicker

Popup picker component for selecting related rows.

```tsx
<RelationPicker
  targetTableId={tableId}
  selectedRowIds={selectedIds}
  onSelect={(rowId, displayValue) => {}}
  onDeselect={(rowId) => {}}
  onClose={() => {}}
  limitType="multiple"
  position={{ top: 100, left: 200 }}
  onSearchRows={(query) => {}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `targetTableId` | `string` | Yes | ID of the table to select rows from |
| `selectedRowIds` | `string[]` | Yes | Currently selected row IDs |
| `onSelect` | `(rowId: string, displayValue: string) => void` | Yes | Handler when row is selected |
| `onDeselect` | `(rowId: string) => void` | Yes | Handler when row is deselected |
| `onClose` | `() => void` | Yes | Handler to close the picker |
| `limitType` | `'single' \| 'multiple'` | Yes | Single or multiple selection mode |
| `position` | `{ top: number; left: number }` | Yes | Position for the picker popup |
| `onSearchRows` | `(query: string) => Promise<Row[]>` | Yes | Callback to search rows |

---

### TableView

The main table component.

```tsx
<TableView
  columns={columns}
  rows={rows}
  selectOptions={selectOptions}
  onCellChange={(rowId, columnId, value) => {}}
  onAddRow={() => {}}
  onDeleteRow={(rowId) => {}}
  onColumnResize={(columnId, width) => {}}
  onAddProperty={(name, type) => {}}
  onCreateSelectOption={(columnId, name, color) => {}}
  onUpdateSelectOption={(optionId, updates) => {}}
  onDeleteSelectOption={(columnId, optionId) => {}}
  sorts={sorts}
  onSortChange={(sorts) => {}}
  selectedRows={selectedRows}
  onSelectionChange={(selection) => {}}
  isLoading={isLoading}
  hasMore={hasMore}
  onLoadMore={() => {}}
  className=""
  style={{}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column[]` | Yes | Column definitions |
| `rows` | `Row[]` | Yes | Row data |
| `selectOptions` | `Map<string, SelectOption[]>` | No | Select options by column |
| `onCellChange` | `(rowId, colId, value) => void` | Yes | Cell change handler |
| `onAddRow` | `() => void` | No | Add row handler |
| `onDeleteRow` | `(rowId) => void` | No | Delete row handler |
| `onColumnResize` | `(colId, width) => void` | No | Column resize handler |
| `onAddProperty` | `(name, type) => void` | No | Add column handler |
| `sorts` | `QuerySort[]` | No | Active sorts |
| `onSortChange` | `(sorts) => void` | No | Sort change handler |
| `selectedRows` | `Set<string>` | No | Selected row IDs |
| `onSelectionChange` | `(selection) => void` | No | Selection handler |
| `isLoading` | `boolean` | No | Loading state |
| `hasMore` | `boolean` | No | Has more rows |
| `onLoadMore` | `() => void` | No | Load more handler |
| `className` | `string` | No | Custom CSS class |
| `style` | `CSSProperties` | No | Inline styles |

---

### FilterBar

Filter controls for the table.

```tsx
<FilterBar
  columns={columns}
  filters={filters}
  selectOptions={selectOptions}
  onFiltersChange={(filters) => {}}
/>
```

#### Props

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column[]` | Yes | Column definitions |
| `filters` | `QueryFilter[]` | Yes | Active filters |
| `selectOptions` | `Map<string, SelectOption[]>` | No | For select column filters |
| `onFiltersChange` | `(filters) => void` | Yes | Filter change handler |

---

## Types

### View

```typescript
interface View {
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
```

### ViewType

```typescript
type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list';
```

### ViewConfig

```typescript
interface ViewConfig {
  filters?: QueryFilter[];
  sorts?: QuerySort[];
  groupBy?: string; // columnId for grouping
  boardConfig?: BoardViewConfig;
  calendarConfig?: CalendarViewConfig;
  galleryConfig?: GalleryViewConfig;
  timelineConfig?: TimelineViewConfig;
  listConfig?: ListViewConfig;
}
```

### BoardViewConfig

```typescript
interface BoardViewConfig {
  groupByColumnId: string;      // must be select/multi_select
  showEmptyGroups?: boolean;
  cardProperties?: string[];    // columnIds to show on cards
}
```

### CalendarViewConfig

```typescript
interface CalendarViewConfig {
  dateColumnId: string;
  endDateColumnId?: string;     // for date ranges
}
```

### GalleryViewConfig

```typescript
interface GalleryViewConfig {
  coverColumnId?: string;       // file column for cover image
  cardSize?: 'small' | 'medium' | 'large';
  cardProperties?: string[];    // columnIds to show on cards
}
```

### TimelineViewConfig

```typescript
interface TimelineViewConfig {
  startDateColumnId: string;
  endDateColumnId?: string;
  groupByColumnId?: string;
}
```

### ListViewConfig

```typescript
interface ListViewConfig {
  showCheckboxes?: boolean;
  indentColumnId?: string;      // for nested lists
}
```

### CreateViewInput

```typescript
interface CreateViewInput {
  tableId: string;
  name: string;
  type: ViewType;
  isDefault?: boolean;
  position?: number;
  config?: ViewConfig;
}
```

### UpdateViewInput

```typescript
interface UpdateViewInput {
  name?: string;
  type?: ViewType;
  isDefault?: boolean;
  config?: ViewConfig;
}
```

### Column

```typescript
interface Column {
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
```

### ColumnType

```typescript
type ColumnType =
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
  | 'rollup';
```

### FormulaColumnConfig

Configuration for formula columns.

```typescript
interface FormulaColumnConfig {
  formula: string;              // The formula expression
  resultType: 'text' | 'number' | 'date' | 'boolean';
}
```

### RollupColumnConfig

Configuration for rollup columns that aggregate values from related rows.

```typescript
interface RollupColumnConfig {
  relationColumnId: string;     // ID of the relation column to traverse
  targetColumnId: string;       // ID of the column to aggregate from related rows
  aggregation: RollupAggregation;
}

type RollupAggregation =
  | 'count'           // Count of related rows
  | 'sum'             // Sum of numeric values
  | 'average'         // Average of numeric values
  | 'min'             // Minimum value
  | 'max'             // Maximum value
  | 'countValues'     // Count of non-empty values
  | 'countUnique'     // Count of unique values
  | 'countEmpty'      // Count of empty values
  | 'countNotEmpty'   // Count of non-empty values (alias)
  | 'percentEmpty'    // Percentage of empty values (0-100)
  | 'percentNotEmpty' // Percentage of non-empty values (0-100)
  | 'showOriginal'    // Array of all values
  | 'showUnique';     // Array of unique values
```

### RelationColumnConfig

Configuration for relation columns that link to rows in other tables.

```typescript
interface RelationColumnConfig {
  targetTableId: string;        // ID of the table to link to
  bidirectional?: boolean;      // Create reverse relation automatically
  reverseColumnId?: string;     // ID of the reverse relation column
  limitType?: 'single' | 'multiple';  // Single or multiple row links
}
```

### RelationValue

Value stored in relation cells.

```typescript
interface RelationValue {
  rowId: string;                // ID of the linked row
  displayValue?: string;        // Cached title for display
}
```

### Row

```typescript
interface Row {
  id: string;
  tableId: string;
  cells: Record<string, CellValue>;
  computed?: Record<string, CellValue>; // Cached formula/rollup values
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CellValue

```typescript
type CellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | string[]           // For multi_select
  | FileReference[]    // For file columns
  | RelationValue[];   // For relation columns
```

### SelectOption

```typescript
interface SelectOption {
  id: string;
  columnId: string;
  name: string;
  color?: string;
  position: number;
}
```

### QueryFilter

```typescript
interface QueryFilter {
  columnId: string;
  operator: FilterOperator;
  value: CellValue;
}

type FilterOperator =
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
```

### QuerySort

```typescript
interface QuerySort {
  columnId: string;
  direction: 'asc' | 'desc';
}
```

---

## DatabaseAdapter Interface

Implement this interface to create a custom storage adapter.

```typescript
interface DatabaseAdapter {
  // Tables
  createTable(input: CreateTableInput): Promise<Table>;
  getTable(tableId: string): Promise<Table | null>;
  updateTable(tableId: string, updates: UpdateTableInput): Promise<Table>;
  deleteTable(tableId: string): Promise<void>;
  listTables(workspaceId: string): Promise<Table[]>;

  // Columns
  createColumn(input: CreateColumnInput): Promise<Column>;
  getColumns(tableId: string): Promise<Column[]>;
  getColumn(columnId: string): Promise<Column | null>;
  updateColumn(columnId: string, updates: UpdateColumnInput): Promise<Column>;
  deleteColumn(columnId: string): Promise<void>;
  reorderColumns(tableId: string, columnIds: string[]): Promise<void>;

  // Select Options
  createSelectOption(input: CreateSelectOptionInput): Promise<SelectOption>;
  getSelectOptions(columnId: string): Promise<SelectOption[]>;
  updateSelectOption(optionId: string, updates: UpdateSelectOptionInput): Promise<SelectOption>;
  deleteSelectOption(optionId: string): Promise<void>;
  reorderSelectOptions(columnId: string, optionIds: string[]): Promise<void>;

  // Rows
  createRow(input: CreateRowInput): Promise<Row>;
  getRow(rowId: string): Promise<Row | null>;
  getRows(tableId: string, query?: QueryOptions): Promise<QueryResult<Row>>;
  updateRow(rowId: string, cells: Record<string, CellValue>): Promise<Row>;
  deleteRow(rowId: string): Promise<void>;
  archiveRow(rowId: string): Promise<void>;
  unarchiveRow(rowId: string): Promise<void>;
  bulkCreateRows(inputs: CreateRowInput[]): Promise<Row[]>;
  bulkDeleteRows(rowIds: string[]): Promise<void>;
  bulkArchiveRows(rowIds: string[]): Promise<void>;

  // Relations
  createRelation(input: CreateRelationInput): Promise<void>;
  deleteRelation(sourceRowId: string, columnId: string, targetRowId: string): Promise<void>;
  getRelatedRows(rowId: string, columnId: string): Promise<Row[]>;
  getRelationsForRow(rowId: string): Promise<Array<{ columnId: string; targetRowId: string }>>;

  // File References
  addFileReference(input: CreateFileRefInput): Promise<FileReference>;
  removeFileReference(fileRefId: string): Promise<void>;
  getFileReferences(rowId: string, columnId: string): Promise<FileReference[]>;
  reorderFileReferences(rowId: string, columnId: string, fileRefIds: string[]): Promise<void>;

  // Views
  createView(input: CreateViewInput): Promise<View>;
  getViews(tableId: string): Promise<View[]>;
  getView(viewId: string): Promise<View | null>;
  updateView(viewId: string, updates: UpdateViewInput): Promise<View>;
  deleteView(viewId: string): Promise<void>;
  reorderViews(tableId: string, viewIds: string[]): Promise<void>;

  // Transactions
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
}
```

### View Methods

#### createView

Creates a new view for a table.

```typescript
createView(input: CreateViewInput): Promise<View>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `input.tableId` | `string` | ID of the table |
| `input.name` | `string` | Name of the view |
| `input.type` | `ViewType` | Type of view (table, board, calendar, etc.) |
| `input.isDefault` | `boolean` | Whether this is the default view |
| `input.position` | `number` | Position in the view list |
| `input.config` | `ViewConfig` | View-specific configuration |

#### getViews

Gets all views for a table.

```typescript
getViews(tableId: string): Promise<View[]>
```

#### getView

Gets a specific view by ID.

```typescript
getView(viewId: string): Promise<View | null>
```

#### updateView

Updates an existing view.

```typescript
updateView(viewId: string, updates: UpdateViewInput): Promise<View>
```

#### deleteView

Deletes a view.

```typescript
deleteView(viewId: string): Promise<void>
```

#### reorderViews

Reorders views by their position.

```typescript
reorderViews(tableId: string, viewIds: string[]): Promise<void>
```

---

## Formula Engine

The FormulaEngine evaluates Notion-like formulas against row data.

### FormulaEngine Class

```typescript
import { FormulaEngine } from '@marlinjai/data-table-core';

const engine = new FormulaEngine(options?: FormulaEngineOptions);
```

#### Constructor Options

```typescript
interface FormulaEngineOptions {
  throwOnError?: boolean;       // Throw errors instead of returning null
  maxDepth?: number;            // Maximum recursion depth (default: 100)
  customFunctions?: Record<string, (...args: FormulaValue[]) => FormulaValue>;
}
```

#### Methods

##### evaluate

Evaluates a formula and returns the result.

```typescript
engine.evaluate(formula: string, row: Row, columns: Column[]): CellValue
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `formula` | `string` | The formula expression to evaluate |
| `row` | `Row` | The row data containing cell values |
| `columns` | `Column[]` | Column definitions for the table |

**Returns:** The computed value, or `null` on error.

**Examples:**

```typescript
// Simple arithmetic with property references
engine.evaluate('prop("Price") * prop("Quantity")', row, columns);
// Returns: 150 (if Price=10, Quantity=15)

// String concatenation
engine.evaluate('concat(prop("First Name"), " ", prop("Last Name"))', row, columns);
// Returns: "John Doe"

// Conditional logic
engine.evaluate('if(prop("Status") == "Complete", "Done", "In Progress")', row, columns);
// Returns: "Done" or "In Progress"

// Math functions
engine.evaluate('round(prop("Price") * 1.08, 2)', row, columns);
// Returns: 10.80
```

##### evaluateWithResult

Evaluates a formula and returns both the result and any error.

```typescript
engine.evaluateWithResult(formula: string, row: Row, columns: Column[]): FormulaResult

interface FormulaResult {
  value: CellValue;
  error?: string;
}
```

##### validate

Validates a formula without evaluating it.

```typescript
engine.validate(formula: string): { isValid: boolean; error?: string }
```

##### getAST

Returns the parsed Abstract Syntax Tree for debugging.

```typescript
engine.getAST(formula: string): ASTNode
```

##### addFunctions

Adds custom functions to the engine.

```typescript
engine.addFunctions(functions: Record<string, (...args: FormulaValue[]) => FormulaValue>): void
```

##### clearCache

Clears the AST cache.

```typescript
engine.clearCache(): void
```

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition / String concatenation | `1 + 2`, `"a" + "b"` |
| `-` | Subtraction | `5 - 3` |
| `*` | Multiplication | `4 * 5` |
| `/` | Division | `10 / 2` |
| `%` | Modulo | `10 % 3` |
| `==` | Equality | `prop("Status") == "Done"` |
| `!=` | Inequality | `prop("Count") != 0` |
| `>` | Greater than | `prop("Price") > 100` |
| `<` | Less than | `prop("Age") < 18` |
| `>=` | Greater than or equal | `prop("Score") >= 70` |
| `<=` | Less than or equal | `prop("Qty") <= 10` |
| `and` | Logical AND | `prop("A") and prop("B")` |
| `or` | Logical OR | `prop("A") or prop("B")` |
| `not` | Logical NOT | `not prop("Archived")` |

### Built-in Functions

The formula engine includes many built-in functions including:

- **Math:** `abs`, `ceil`, `floor`, `round`, `sqrt`, `pow`, `min`, `max`
- **String:** `concat`, `length`, `lower`, `upper`, `trim`, `substring`, `replace`, `contains`
- **Date:** `now`, `today`, `dateAdd`, `dateSub`, `year`, `month`, `day`
- **Logic:** `if`, `and`, `or`, `not`, `empty`, `coalesce`

---

## FormulaParser Class

The FormulaParser parses formula strings into an Abstract Syntax Tree (AST).

```typescript
import { FormulaParser } from '@marlinjai/data-table-core';

const parser = new FormulaParser();
const ast = parser.parse(formula: string): ASTNode;
```

### AST Node Types

```typescript
type ASTNode =
  | NumberLiteral       // e.g., 42, 3.14
  | StringLiteral       // e.g., "hello"
  | BooleanLiteral      // true, false
  | PropertyReference   // prop("Column Name")
  | BinaryExpression    // a + b, x == y
  | UnaryExpression     // not x, -5
  | FunctionCall        // concat("a", "b")
  | ConditionalExpression;  // condition ? true : false
```

### FormulaParseError

Thrown when parsing fails.

```typescript
class FormulaParseError extends Error {
  position: number;  // Position in the formula where error occurred
}
```

---

## Rollup Engine

The RollupEngine calculates aggregated values from related rows.

### RollupEngine Class

```typescript
import { RollupEngine } from '@marlinjai/data-table-core';

const engine = new RollupEngine();
```

#### calculate

Calculates a rollup value based on the configuration and related rows.

```typescript
engine.calculate(
  config: RollupColumnConfig,
  relatedRows: Row[],
  targetColumn: Column
): RollupResult

type RollupResult = number | CellValue[] | null;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `RollupColumnConfig` | Rollup configuration |
| `relatedRows` | `Row[]` | Array of related rows |
| `targetColumn` | `Column` | The column to aggregate |

**Examples:**

```typescript
const engine = new RollupEngine();

// Sum prices from related line items
const total = engine.calculate(
  { relationColumnId: 'items', targetColumnId: 'price', aggregation: 'sum' },
  lineItemRows,
  priceColumn
);
// Returns: 250.00

// Count related tasks
const taskCount = engine.calculate(
  { relationColumnId: 'tasks', targetColumnId: 'id', aggregation: 'count' },
  taskRows,
  idColumn
);
// Returns: 5

// Get unique categories
const categories = engine.calculate(
  { relationColumnId: 'products', targetColumnId: 'category', aggregation: 'showUnique' },
  productRows,
  categoryColumn
);
// Returns: ['Electronics', 'Books', 'Clothing']

// Calculate completion percentage
const percentComplete = engine.calculate(
  { relationColumnId: 'tasks', targetColumnId: 'completed', aggregation: 'percentNotEmpty' },
  taskRows,
  completedColumn
);
// Returns: 80 (80% of tasks are completed)
```

### Aggregation Types

| Aggregation | Return Type | Description |
|-------------|-------------|-------------|
| `count` | `number` | Total count of related rows |
| `countValues` | `number` | Count of non-empty values |
| `countUnique` | `number` | Count of unique values |
| `countEmpty` | `number` | Count of empty/null values |
| `countNotEmpty` | `number` | Count of non-empty values |
| `sum` | `number` | Sum of numeric values |
| `average` | `number` | Average of numeric values |
| `min` | `number` | Minimum value (works with dates too) |
| `max` | `number` | Maximum value (works with dates too) |
| `percentEmpty` | `number` | Percentage of empty values (0-100) |
| `percentNotEmpty` | `number` | Percentage of non-empty values (0-100) |
| `showOriginal` | `CellValue[]` | Array of all non-empty values |
| `showUnique` | `CellValue[]` | Array of unique non-empty values |
```
