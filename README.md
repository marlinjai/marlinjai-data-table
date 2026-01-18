# @marlinjai/data-table

A **reusable, storage-agnostic Notion-like data table** React component library.

## Features

- **Notion-like UX** - Inline editing, sorting, filtering, column management
- **Storage-agnostic** - Pluggable adapters for D1, Supabase, PostgreSQL
- **Fully themeable** - CSS variables with dark mode support
- **TypeScript-first** - Full type safety
- **Formula Engine** - Computed columns with 50+ built-in functions
- **Rollups** - Aggregate data from related tables with 14 aggregation types
- **Relations** - Link rows across tables with an intuitive picker UI
- **Multiple Views** - Table, Board (Kanban), and Calendar views
- **Sub-items** - Hierarchical rows with parent-child relationships
- **Grouping** - Group rows by select/multi-select columns

## Feature Status

### Column Types
- [x] Text
- [x] Number (with currency, percent formatting)
- [x] Date
- [x] Boolean (checkbox)
- [x] Select (single option)
- [x] Multi-select (multiple options)
- [x] URL
- [x] File (upload with MIME restrictions)
- [x] Formula (50+ functions)
- [x] Relation (cross-table links)
- [x] Rollup (14 aggregation types)
- [ ] Status (workflow stages)
- [ ] Person (user assignment)
- [ ] Created time / Last edited time

### Views
- [x] Table view
- [x] Board view (Kanban)
- [x] Calendar view
- [ ] Gallery view
- [ ] Timeline view
- [ ] List view

### Features
- [x] Inline cell editing
- [x] Column resize & reorder
- [x] Sorting
- [x] Filtering
- [x] Grouping
- [x] Sub-items (hierarchical rows)
- [x] Row selection
- [x] Dark mode
- [ ] Footer calculations
- [ ] Search
- [ ] Undo/redo
- [ ] Export/Import

## Installation

```bash
npm install @marlinjai/data-table-react @marlinjai/data-table-core
# or
pnpm add @marlinjai/data-table-react @marlinjai/data-table-core
```

## Quick Start

```tsx
import { DataTableProvider, TableView, useTable } from '@marlinjai/data-table-react';
import { MemoryAdapter } from '@marlinjai/data-table-adapter-memory';
import '@marlinjai/data-table-react/styles';

const adapter = new MemoryAdapter();

function App() {
  return (
    <DataTableProvider dbAdapter={adapter} workspaceId="my-workspace">
      <MyTable />
    </DataTableProvider>
  );
}

function MyTable() {
  const { columns, rows, updateCell, addRow } = useTable({ tableId: 'my-table' });

  return (
    <TableView
      columns={columns}
      rows={rows}
      onCellChange={updateCell}
      onAddRow={addRow}
    />
  );
}
```

## Column Types

| Type | Description |
|------|-------------|
| `text` | Plain text |
| `number` | Numeric values |
| `date` | Date/datetime |
| `boolean` | Checkbox |
| `select` | Single select dropdown |
| `multi_select` | Multiple select tags |
| `url` | URL link |
| `file` | File upload with MIME type restrictions |
| `relation` | Link to rows in another table |
| `rollup` | Aggregate values from related rows |
| `formula` | Computed values using formulas |

## Formula Engine

Create computed columns with powerful formulas. The formula engine includes a recursive descent parser, AST caching for performance, and 50+ built-in functions.

**Example formulas:**

```
prop("Amount") * 1.1
if(prop("Status") = "Done", "✓", "")
concat(prop("First Name"), " ", prop("Last Name"))
dateAdd(prop("Due Date"), 7, "days")
```

**Function categories:**

| Category | Functions |
|----------|-----------|
| Math | `add`, `subtract`, `multiply`, `divide`, `mod`, `pow`, `sqrt`, `abs`, `round`, `floor`, `ceil`, `min`, `max` |
| Text | `concat`, `length`, `lower`, `upper`, `trim`, `replace`, `slice`, `contains`, `split`, `join` |
| Date | `now`, `today`, `dateAdd`, `dateBetween`, `formatDate`, `year`, `month`, `day` |
| Logical | `if`, `and`, `or`, `not`, `empty`, `equal` |

## Rollups

Aggregate data from related tables using rollup columns. Requires a relation column to reference.

**Aggregation types:**

| Type | Description |
|------|-------------|
| `count` | Count of all related rows |
| `sum` | Sum of numeric values |
| `average` | Average of numeric values |
| `min` / `max` | Minimum/maximum value |
| `countValues` | Count of non-empty values |
| `countUnique` | Count of unique values |
| `countEmpty` / `countNotEmpty` | Count empty or non-empty cells |
| `percentEmpty` / `percentNotEmpty` | Percentage of empty or non-empty cells |
| `showOriginal` | Display all values |
| `showUnique` | Display unique values only |

## Views

Switch between different views of your data using the view system.

### Table View (Default)

The standard spreadsheet-style view with inline editing, sorting, and filtering.

### Board View (Kanban)

Visualize data as a Kanban board grouped by select or multi-select columns.

```tsx
import { BoardView } from '@marlinjai/data-table-react';

<BoardView
  columns={columns}
  rows={rows}
  groupByColumn="status"
  onCellChange={updateCell}
/>
```

- Drag-and-drop cards between columns
- Group by any `select` or `multi_select` column
- Customizable card display

### Calendar View

Display date-based data in a monthly calendar grid.

```tsx
import { CalendarView } from '@marlinjai/data-table-react';

<CalendarView
  columns={columns}
  rows={rows}
  dateColumn="due_date"
  onCellChange={updateCell}
/>
```

- Month grid with navigation
- Support for date ranges (multi-day events)
- Click to create or edit events

### View Management

Use the `useViews` hook and `ViewSwitcher` component to manage views:

```tsx
import { useViews, ViewSwitcher } from '@marlinjai/data-table-react';

function MyTable() {
  const { views, activeView, createView, switchView, updateView, deleteView } = useViews({
    tableId: 'my-table',
  });

  return (
    <>
      <ViewSwitcher
        views={views}
        activeView={activeView}
        onSwitch={switchView}
        onCreate={createView}
      />
      {/* Render active view */}
    </>
  );
}
```

## Relations

Link rows across tables with the relation column type. The relation UI provides an intuitive experience for managing linked data.

**Components:**

- `RelationCell` - Displays linked rows as interactive chips
- `RelationPicker` - Dropdown to search and select related rows

## Theming

Customize with CSS variables:

```css
:root {
  --dt-accent-primary: #8b5cf6;
  --dt-bg-primary: #000;
}
```

Dark mode is automatic via `prefers-color-scheme` or manual via `.dark` class.

See [Theming Guide](./docs/theming.md) for full details.

## Documentation

- [Architecture](./docs/architecture.md)
- [Theming](./docs/theming.md)
- [API Reference](./docs/api.md)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run demo
pnpm demo
```

## License

MIT
