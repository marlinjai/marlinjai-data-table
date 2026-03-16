---
title: Architecture
description: System design, patterns, storage architecture, and package structure
order: 1
summary: Architecture documentation for the @marlinjai/data-table package covering system design, adapter pattern, real-table storage, package structure, and core/react/adapter layering.
category: documentation
tags: [data-table, architecture, adapter-pattern, monorepo, real-tables, prisma]
projects: [data-table, data-brain]
status: active
date: 2026-03-16
---

# Architecture

This document describes the architecture of the `@marlinjai/data-table` package.

## Package Structure

```
@marlinjai/data-table/
├── packages/
│   ├── core/                         # Core types, interfaces, engines
│   │   ├── src/
│   │   │   ├── types.ts                # All TypeScript interfaces
│   │   │   ├── db-adapter.ts           # DatabaseAdapter interface (41 methods)
│   │   │   ├── formula/                # Formula Engine (65 built-in functions)
│   │   │   └── rollup/                 # Rollup Engine (14 aggregation types)
│   │   └── package.json
│   │
│   ├── adapter-shared/               # Shared adapter utilities
│   │   ├── src/
│   │   │   ├── identifiers.ts          # SQL identifier sanitization
│   │   │   ├── type-mapping.ts         # Column type → storage mapping
│   │   │   ├── query-builder.ts        # WHERE/ORDER BY with CAST expressions
│   │   │   ├── ddl-capabilities.ts     # Database feature matrix
│   │   │   ├── schema-verify.ts        # Metadata ↔ table drift detection
│   │   │   └── batch-loader.ts         # Junction data batch loading
│   │   └── package.json
│   │
│   ├── adapter-prisma/               # PostgreSQL adapter (real table columns)
│   │   ├── prisma/schema.prisma        # Metadata table definitions
│   │   ├── src/
│   │   │   ├── adapter.ts              # PrismaAdapter (41 methods)
│   │   │   ├── ddl.ts                  # CREATE/DROP TABLE, ADD/DROP COLUMN
│   │   │   └── migration.ts            # Lazy JSON → real table migration
│   │   └── package.json
│   │
│   ├── adapter-d1/                   # Cloudflare D1 adapter (edge SQLite)
│   │   ├── src/
│   │   │   ├── index.ts                # D1Adapter (41 methods)
│   │   │   ├── ddl-compat.ts           # Table-rebuild fallback for D1
│   │   │   └── migration.ts            # Lazy migration for D1
│   │   └── package.json
│   │
│   ├── adapter-memory/               # In-memory adapter (testing)
│   ├── adapter-data-brain/           # HTTP adapter (SDK → Data Brain API)
│   │
│   ├── react/                        # React components + hooks
│   │   ├── src/
│   │   │   ├── providers/              # DataTableProvider
│   │   │   ├── components/             # TableView, cells, filters
│   │   │   │   └── views/              # ViewSwitcher, BoardView, CalendarView
│   │   │   ├── hooks/                  # useTable, useColumns, useViews
│   │   │   └── styles/                 # CSS variables + base styles
│   │   └── package.json
│   │
│   └── file-adapter-storage-brain/   # Storage Brain file adapter
│
└── demo/                             # Demo application
```

### Dependency Graph

```
                      data-table-core
                     /      |       \
                    /       |        \
           adapter-shared   |    react (UI)
            /       \       |
           /         \      |
    adapter-prisma  adapter-d1    adapter-memory
           \         /
            \       /
        data-brain API  ←──  data-brain SDK
                                    │
                            adapter-data-brain
                            (HTTP adapter for client apps)
```

## Design Patterns

### Adapter Pattern

The package uses the **Adapter Pattern** to decouple data storage from the UI layer:

```
┌─────────────────┐     ┌───────────────────┐
│   React Layer   │────▶│  DatabaseAdapter  │
│  (components)   │     │   (41 methods)    │
└─────────────────┘     └───────────────────┘
                               │
          ┌────────────────┬───┴───────┬────────────────┐
          ▼                ▼           ▼                ▼
   ┌────────────┐   ┌──────────┐  ┌──────────┐  ┌────────────┐
   │   Prisma   │   │    D1    │  │  Memory  │  │ Data Brain │
   │ (Postgres) │   │  (Edge)  │  │ (Testing)│  │   (HTTP)   │
   └─────┬──────┘   └────┬─────┘  └──────────┘  └────────────┘
         │                │
         └──────┬─────────┘
                ▼
         ┌──────────────┐
         │adapter-shared│  (identifiers, type mapping,
         │  (utilities) │   query builder, DDL, schema verify)
         └──────────────┘
```

**Benefits:**
- Test with in-memory adapter, deploy with Prisma/D1/Data Brain
- All adapters share code via `adapter-shared`
- No storage logic in UI components

### Component Hierarchy

```
DataTableProvider (context)
└── TableView
    ├── TableHeader
    │   └── HeaderCell (sortable, resizable)
    ├── TableBody
    │   └── TableRow
    │       └── CellRenderer → TextCell | NumberCell | SelectCell | ...
    └── AddRowButton
```

### Portal Pattern for Dropdowns

Dropdowns (SelectCell, MultiSelectCell) use React Portals to render to `document.body`:

```tsx
{isOpen && createPortal(
  <div className="dt-dropdown" style={{ position: 'fixed', ... }}>
    {/* dropdown content */}
  </div>,
  document.body
)}
```

**Why portals?**
- Avoids clipping from parent `overflow: hidden`
- Correct z-index stacking
- Works in scrollable containers

## Data Flow

```
User Action
    │
    ▼
Component Event Handler (onClick, onChange)
    │
    ▼
Hook Method (updateCell, addRow, etc.)
    │
    ▼
DatabaseAdapter Method (async)
    │
    ▼
Local State Update (optimistic or after response)
    │
    ▼
React Re-render
```

## Storage Architecture: Real Table Columns

The adapter stores each user column as a real TEXT column in a per-table SQL table, not as a JSON blob. This enables proper indexing, type-aware filtering, and atomic updates.

### How Data Is Stored

Each data-table "table" becomes a real SQL table with the table ID as its name:

```
Metadata tables (shared):              Per-table real table:
┌─────────────┐                        ┌──────────────────────────────────────┐
│ dt_tables   │                        │ tbl_abc123                           │
│ dt_columns  │  ←── describes ───→    │ id | _archived | col_name | col_age │
│ dt_views    │                        │ r1 | 0         | John     | 42      │
└─────────────┘                        │ r2 | 0         | Jane     | 28      │
                                       └──────────────────────────────────────┘
Junction tables (shared):
┌─────────────────────┐
│ dt_row_select_values │  ← multi_select values
│ dt_relations         │  ← row-to-row links
│ dt_files             │  ← file references
└─────────────────────┘
```

### Column Type to Storage Mapping

| Column Type | Storage | Cast for Filter/Sort |
|-------------|---------|---------------------|
| text, url, select | TEXT column (as-is) | none |
| number | TEXT column (`"42"`) | `::NUMERIC` (PG) / `CAST(AS REAL)` (SQLite) |
| date, created_time, last_edited_time | TEXT column (ISO 8601) | `::TIMESTAMPTZ` (PG) / text sort (SQLite) |
| boolean | TEXT column (`"true"/"false"`) | none (lexicographic works) |
| multi_select | `dt_row_select_values` junction table | JOIN query |
| relation | `dt_relations` junction table | JOIN query |
| file | `dt_files` junction table | JOIN query |
| formula | Not stored — computed post-query by FormulaEngine | N/A |
| rollup | Not stored — computed post-query by RollupEngine | N/A |

**Why TEXT for everything?** Column type changes (e.g., number → text) become metadata-only — no DDL, no data migration. Expression indexes close the performance gap.

### SQL Identifier Safety

All table/column names come from system-generated IDs, validated by regex before use in SQL:

```typescript
safeTableName("tbl_abc123")   // → "tbl_abc123" (validated)
safeColumnName("col_abc123")  // → "col_abc123" (validated)
safeTableName("'; DROP --")   // → throws Error
```

Filter/sort column IDs are additionally validated against actual table columns to prevent injection.

### Row Query Flow (End to End)

```
1. adapter.getRows(tableId, { filters, sorts, include })
2. Check migration status (lazy-migrate if needed)
3. Build SQL via adapter-shared:
   SELECT * FROM tbl_abc123
   WHERE _archived = 0 AND (col_age)::NUMERIC > $1
   ORDER BY (col_age)::NUMERIC ASC
   LIMIT 50
4. Map raw rows: deserializeCell("42", 'number') → 42
5. Eager-load junction data if include is set (batch queries, no N+1)
6. Compute formulas and rollups post-query
7. Return { items, total, hasMore, cursor }
```

### Row Update Flow

```
-- Single atomic UPDATE (no read-merge-write race condition)
UPDATE tbl_abc123 SET col_name = $1, col_age = $2, _updated_at = $3 WHERE id = $4
```

### The `include` Parameter

Junction data is not included by default in `getRows()`. Opt in with `include`:

```typescript
const result = await adapter.getRows(tableId, {
  include: ['files', 'relations', 'multiSelect']
});
// row.cells now contains file refs, relation values, and multi-select arrays
```

`getRow()` (single row) always eager-loads all junction data.

### Adapter Comparison

| | PrismaAdapter | D1Adapter | MemoryAdapter | DataBrainAdapter |
|---|---|---|---|---|
| **Database** | PostgreSQL | Cloudflare D1 | In-memory | HTTP → API |
| **Storage** | Real TEXT columns | JSON blobs (upgrade in progress) | JS objects | Delegates |
| **Transactions** | Full ACID | D1 batch | Sync | Server-side |
| **Filter casting** | `::NUMERIC` | `CAST(AS REAL)` | JS comparison | Server-side |
| **Use case** | Production | Edge | Testing | Client apps |

### Lazy Migration

Tables using JSON blobs migrate to real columns on first access:

1. Check `dt_tables.migrated` flag
2. If `false`: CREATE real table, copy data from `dt_rows`, mark migrated
3. Original `dt_rows` data preserved for rollback

### Database Entities

```typescript
interface Table {
  id: string;
  workspaceId: string;
  name: string;
  icon?: string;
  migrated?: boolean; // true = real table columns, false = JSON blobs
}

interface Column {
  id: string;
  tableId: string;
  name: string;
  type: ColumnType; // determines storage strategy
  position: number;
  width: number;
  config?: ColumnConfig;
}

interface Row {
  id: string;
  tableId: string;
  parentRowId?: string;
  cells: Record<string, CellValue>; // adapter translates to/from real columns
  archived: boolean;
}

interface SelectOption {
  id: string;
  columnId: string;
  name: string;
  color?: string;
}
```

## CSS Architecture

All styles use CSS variables with the `--dt-` prefix:

```
variables.css    → Defines all CSS variables (colors, sizing, etc.)
base.css        → Base component styles using the variables
```

Consumers can override any variable:
```css
:root {
  --dt-bg-primary: #000;
  --dt-text-primary: #fff;
}
```

Dark mode is handled via:
1. `@media (prefers-color-scheme: dark)` - Auto
2. `.dark` class or `[data-theme="dark"]` - Manual

## Formula Engine

The Formula Engine (`packages/core/src/formula/`) provides Notion-like formula evaluation capabilities using a recursive descent parser and AST-based evaluation.

### Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Formula String  │────▶│  FormulaParser   │────▶│      AST         │
│  "prop("A") + 1" │     │  (Lexer + Parser)│     │  (Abstract Tree) │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │    Cell Value    │◀────│  FormulaEngine   │
                         │                  │     │  (AST Evaluator) │
                         └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────────┐
                                                  │ FormulaFunctions │
                                                  │  (65 built-ins) │
                                                  └──────────────────┘
```

### Components

| File | Responsibility |
|------|----------------|
| `FormulaParser.ts` | Lexer (tokenizer) + recursive descent parser producing AST |
| `FormulaFunctions.ts` | Registry of 65 built-in functions (math, text, logic, date) |
| `FormulaEngine.ts` | AST evaluation with caching and custom function support |

### Design Pattern: Visitor Pattern

The engine uses the **Visitor Pattern** for AST evaluation. Each node type has a corresponding evaluation method:

```typescript
private evaluateNode(node: ASTNode, context: EvaluationContext): FormulaValue {
  switch (node.type) {
    case 'NumberLiteral':
      return node.value;
    case 'PropertyReference':
      return this.evaluatePropertyReference(node.propertyName, context);
    case 'BinaryExpression':
      return this.evaluateBinaryExpression(node.operator, node.left, node.right, context);
    case 'FunctionCall':
      return this.evaluateFunctionCall(node.name, node.arguments, context);
    // ... other node types
  }
}
```

### AST Node Types

```
ASTNode
├── NumberLiteral      (e.g., 42, 3.14)
├── StringLiteral      (e.g., "hello")
├── BooleanLiteral     (true, false)
├── PropertyReference  (e.g., prop("Column Name"))
├── BinaryExpression   (e.g., a + b, x == y)
├── UnaryExpression    (e.g., not x, -5)
├── FunctionCall       (e.g., add(1, 2))
└── ConditionalExpression (ternary: a ? b : c)
```

### Built-in Function Categories

| Category | Functions |
|----------|-----------|
| Math | add, subtract, multiply, divide, mod, abs, round, floor, ceil, min, max, pow, sqrt, sign, ln, log10, exp |
| Text | concat, length, contains, replace, lower, upper, trim, slice, split, startsWith, endsWith, indexOf, repeat, padStart, padEnd, format, toNumber |
| Logic | if, and, or, not, empty, coalesce, equal, unequal, larger, smaller, largerEq, smallerEq |
| Date | now, today, dateAdd, dateSubtract, dateBetween, formatDate, year, month, day, dayOfWeek, hour, minute, second, timestamp, date, parseDate, startOf, endOf |

### Performance Features

- **AST Caching**: Parsed formulas are cached to avoid re-parsing identical formula strings
- **Lazy Evaluation**: Conditional expressions only evaluate the taken branch
- **Depth Limiting**: Configurable max evaluation depth prevents infinite recursion

## Rollup Engine

The Rollup Engine (`packages/core/src/rollup/`) calculates aggregated values from related rows based on rollup configuration.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Current Row    │     │ Related Rows    │     │  RollupEngine   │
│  (has relation) │────▶│ (via relation)  │────▶│  .calculate()   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │ Aggregated Value│
                                                │ (number/array)  │
                                                └─────────────────┘
```

### Supported Aggregation Types (14 total)

| Category | Aggregations |
|----------|--------------|
| Counting | `count`, `countValues`, `countUnique`, `countEmpty`, `countNotEmpty` |
| Numeric | `sum`, `average`, `min`, `max` |
| Percentage | `percentEmpty`, `percentNotEmpty` |
| Display | `showOriginal`, `showUnique` |

### Usage Example

```typescript
const engine = new RollupEngine();
const result = engine.calculate(
  { relationColumnId: 'rel1', targetColumnId: 'price', aggregation: 'sum' },
  relatedRows,
  priceColumn
);
// result = 150 (sum of all related row prices)
```

## View System

The View System provides multiple ways to visualize the same table data. Views are persisted and can be customized with filters, sorts, and view-specific configurations.

### View Types

```typescript
type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list';
```

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       View Layer (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ ViewSwitcher│  │  useViews   │  │  View       │             │
│  │ (component) │  │  (hook)     │  │  Components │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DatabaseAdapter (Core)                        │
│  createView | getViews | updateView | deleteView | reorderViews │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Storage Backend                            │
│           (Memory, D1, Data Brain, etc.)                         │
└─────────────────────────────────────────────────────────────────┘
```

### View Data Model

```typescript
interface View {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  position: number;
  config: ViewConfig;
  isDefault?: boolean;
}

interface ViewConfig {
  filters?: FilterConfig[];
  sorts?: SortConfig[];
  hiddenColumns?: string[];
  boardConfig?: BoardViewConfig;      // For board views
  calendarConfig?: CalendarViewConfig; // For calendar views
  // ... other view-specific configs
}
```

### useViews Hook

Located at `packages/react/src/hooks/useViews.ts`, provides view state management:

```typescript
interface UseViewsResult {
  views: View[];
  currentView: View | null;
  isLoading: boolean;
  error: Error | null;

  // Operations
  createView: (input) => Promise<View>;
  updateView: (viewId, updates) => Promise<View>;
  deleteView: (viewId) => Promise<void>;
  reorderViews: (viewIds) => Promise<void>;
  setCurrentView: (viewId) => void;
  refresh: () => Promise<void>;
}
```

### ViewSwitcher Component

Located at `packages/react/src/components/views/ViewSwitcher.tsx`, provides:
- Tab-based view switching UI
- Inline view renaming
- View creation menu (all 6 view types)
- View deletion with confirmation

## BoardView (Kanban)

The BoardView (`packages/react/src/components/views/BoardView.tsx`) displays data as a Kanban board with drag-and-drop support.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BoardView                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ No Status   │  │ Column 1    │  │ Column 2    │  │ ...     ││
│  │ (null group)│  │ (option 1)  │  │ (option 2)  │  │         ││
│  │             │  │             │  │             │  │         ││
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │  │         ││
│  │  │ Card  │  │  │  │ Card  │  │  │  │ Card  │  │  │         ││
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │  │         ││
│  │  ┌───────┐  │  │  ┌───────┐  │  │             │  │         ││
│  │  │ Card  │  │  │  │ Card  │  │  │             │  │         ││
│  │  └───────┘  │  │  └───────┘  │  │             │  │         ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Drag-and-Drop Architecture

```
User Drag Start
      │
      ▼
handleDragStart()
  - Set draggingRowId state
  - Set dataTransfer data
  - Apply visual feedback (opacity)
      │
      ▼
handleDragOver()
  - Track dragOverGroup for visual feedback
  - Allow drop (preventDefault)
      │
      ▼
handleDrop()
  - Determine new group value
  - Update cell value via onCellChange
  - Clear drag state
      │
      ▼
handleDragEnd()
  - Reset all drag-related state
  - Restore visual styling
```

### Configuration

```typescript
interface BoardViewConfig {
  groupByColumnId: string;    // Must be select or multi_select column
  cardProperties: string[];   // Column IDs to display on cards
  showEmptyGroups?: boolean;  // Show columns with no cards
}
```

### Key Features

- Groups rows by select/multi-select column values
- Drag-and-drop to change row's group value
- "No Status" column for rows without a group value
- Configurable card properties (which fields to display)
- Add card button per column (pre-fills group value)

## CalendarView

The CalendarView (`packages/react/src/components/views/CalendarView.tsx`) displays data on a date-based grid layout.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CalendarView                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  < >  Today              January 2024                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                    │
│  │ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │                    │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                    │
│  │     │  1  │  2  │  3  │  4  │  5  │  6  │                    │
│  │     │Event│     │     │Event│     │     │                    │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                    │
│  │  7  │  8  │  9  │ 10  │ 11  │ 12  │ 13  │                    │
│  │     │     │Event│Multi-day span────│     │                    │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Event Mapping Flow

```
Row Data                     Calendar Events
┌──────────────────┐        ┌──────────────────┐
│ Row 1            │        │                  │
│  startDate: 1/5  │───────▶│ Jan 5: [Event 1] │
│  endDate: 1/7    │        │ Jan 6: [Event 1] │
│                  │        │ Jan 7: [Event 1] │
├──────────────────┤        ├──────────────────┤
│ Row 2            │        │                  │
│  startDate: 1/5  │───────▶│ Jan 5: [Event 2] │
│  endDate: null   │        │                  │
└──────────────────┘        └──────────────────┘
```

### Configuration

```typescript
interface CalendarViewConfig {
  dateColumnId: string;      // Column containing start date
  endDateColumnId?: string;  // Optional column for multi-day events
  showWeekends?: boolean;
}
```

### Key Features

- Month navigation (prev/next/today)
- Multi-day event spanning
- Visual distinction for current day, selected day, and out-of-month days
- Event click handlers
- Day click handlers (for adding new events)
- Event count footer

## Sub-items (Hierarchical Rows)

The data table supports hierarchical row structures where rows can have parent-child relationships, similar to Notion's sub-items feature.

### Data Model

```typescript
interface Row {
  id: string;
  tableId: string;
  parentRowId?: string; // For sub-items/hierarchical rows
  cells: Record<string, CellValue>;
  // ...
}
```

### Configuration

```typescript
interface SubItemsConfig {
  enabled: boolean;
  displayMode?: 'nested' | 'flat'; // nested shows hierarchy, flat shows all
  filterMode?: 'all' | 'parents' | 'subitems'; // What to show
  collapsedParents?: string[]; // Parent row IDs that are collapsed
}
```

### Query Options

```typescript
interface RowQueryOptions {
  // ...
  parentRowId?: string | null; // null = top-level only, undefined = all, string = children of parent
  includeSubItems?: boolean; // Include all sub-items recursively
}
```

### Creating Sub-items

```typescript
interface CreateRowInput {
  tableId: string;
  parentRowId?: string; // For creating sub-items
  cells?: Record<string, CellValue>;
}
```

### Display Modes

| Mode | Description |
|------|-------------|
| `nested` | Shows hierarchy with indentation, parent rows have expand/collapse |
| `flat` | Shows all rows at the same level, ignores hierarchy |

### Filter Modes

| Mode | Description |
|------|-------------|
| `all` | Show all rows (parents and sub-items) |
| `parents` | Show only top-level rows (no sub-items) |
| `subitems` | Show only sub-items (no top-level rows) |

## Grouping System

The grouping system allows rows to be organized into collapsible groups based on select or multi-select column values.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TableView                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ GroupHeader (Group A)                              [▼] 5  │  │
│  │  ├── Row 1                                                │  │
│  │  ├── Row 2                                                │  │
│  │  └── Row 3                                                │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ GroupHeader (Group B)                              [▶] 3  │  │
│  │  (collapsed - rows hidden)                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### GroupHeader Component

Located at `packages/react/src/components/GroupHeader.tsx`:

```typescript
interface GroupHeaderProps {
  label: string;           // Group name (option label)
  rowCount: number;        // Number of rows in group
  isCollapsed: boolean;    // Collapse state
  onToggleCollapse: () => void;
  colSpan: number;         // Table columns to span
  className?: string;
}
```

### Features

- **Collapsible groups**: Click header to expand/collapse
- **Row count badge**: Shows number of rows in each group
- **Visual feedback**: Chevron rotates to indicate state
- **"No Status" group**: Rows without a group value appear in a special group

### Grouping Configuration

Grouping is configured through the view config:

```typescript
interface ViewConfig {
  // ...
  groupByColumnId?: string; // Must be select or multi_select column
}
```

### Usage

1. Add a `select` or `multi_select` column to your table
2. Configure the view with `groupByColumnId` pointing to that column
3. Rows are automatically grouped by their value in that column
4. Rows with no value appear in the "No Status" group
