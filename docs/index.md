---
title: Data Table
description: Notion-like database component with adapters for D1, Data Brain, and more
order: 0
summary: Landing page for the @marlinjai/data-table documentation, a Notion-like database component with adapters for D1, in-memory, Data Brain, and Storage Brain file adapter.
type: documentation
tags: [data-table, index, notion-like, database-component]
projects: [data-table]
---

# Data Table Documentation

Welcome to the `@marlinjai/data-table` documentation.

## Contents

- [Architecture](/projects/data-table/architecture) - System design, patterns, package structure
- [Theming](/projects/data-table/theming) - CSS customization and dark mode
- [API Reference](/projects/data-table/api) - Hooks and component API
- [Sub-items](/projects/data-table/sub-items) - Hierarchical rows with parent-child relationships
- [Grouping](/projects/data-table/grouping) - Group rows by select/multi-select columns

## Getting Started

### Installation

```bash
npm install @marlinjai/data-table-react @marlinjai/data-table-core
# or
pnpm add @marlinjai/data-table-react @marlinjai/data-table-core
```

### Basic Usage

```tsx
import { DataTableProvider, TableView, useTable } from '@marlinjai/data-table-react';
import { MemoryAdapter } from '@marlinjai/data-table-adapter-memory';

// Create adapter
const adapter = new MemoryAdapter();

function App() {
  return (
    <DataTableProvider dbAdapter={adapter} workspaceId="my-workspace">
      <MyTable />
    </DataTableProvider>
  );
}

function MyTable() {
  const { table, columns, rows, updateCell } = useTable({ tableId: 'my-table' });

  return (
    <TableView
      columns={columns}
      rows={rows}
      onCellChange={updateCell}
    />
  );
}
```

## Core Concepts

### Adapter Pattern

The data table is **storage-agnostic**. You provide an adapter that implements the `DatabaseAdapter` interface:

- `MemoryAdapter` - In-memory storage (for testing/demos)
- `D1Adapter` - Cloudflare D1
- `DataBrainAdapter` - Data Brain HTTP adapter
- `StorageBrainFileAdapter` - Storage Brain file adapter

### Column Types

| Type | Description |
|------|-------------|
| `text` | Plain text |
| `number` | Numeric values |
| `date` | Date/datetime |
| `boolean` | Checkbox |
| `select` | Single select dropdown |
| `multi_select` | Multiple select tags |
| `url` | URL link |
| `formula` | Computed values from formulas |
| `rollup` | Aggregated values from related rows |
| `relation` | Links to rows in other tables |
| `file` | File attachments |
| `created_time` | Auto-populated row creation timestamp |
| `last_edited_time` | Auto-populated last edit timestamp |

### Theming

All components use CSS variables for styling. See [Theming](/projects/data-table/theming) for details.

```css
:root {
  --dt-accent-primary: #8b5cf6; /* Change accent color */
}
```

Dark mode is supported via:
- Auto: `@media (prefers-color-scheme: dark)`
- Manual: `.dark` class or `data-theme="dark"` attribute

## Advanced Features

### Formula Columns

Formula columns compute values dynamically based on other columns in the same row. Use the `prop()` function to reference column values.

```tsx
// Create a formula column
const totalColumn = {
  id: 'total',
  name: 'Total',
  type: 'formula',
  config: {
    formula: 'prop("Price") * prop("Quantity")'
  }
};
```

**Supported operations:**
- Arithmetic: `+`, `-`, `*`, `/`
- Property access: `prop("Column Name")`
- Functions: `round()`, `floor()`, `ceil()`, `abs()`

**Examples:**
```
prop("Price") * prop("Quantity")              // Multiply two columns
prop("Subtotal") + prop("Tax")                // Add columns
round(prop("Price") * 1.1, 2)                 // Round to 2 decimal places
```

### Relation Columns

Relation columns create links between rows in different tables, enabling relational data modeling.

```tsx
// Create a relation column linking to another table
const authorColumn = {
  id: 'author',
  name: 'Author',
  type: 'relation',
  config: {
    targetTableId: 'authors-table',
    limitType: 'single'  // 'single' or 'multiple'
  }
};
```

**Limit types:**
| Type | Description |
|------|-------------|
| `single` | Link to one related row |
| `multiple` | Link to multiple related rows |

### Rollup Columns

Rollup columns aggregate values from related rows via a relation column.

```tsx
// Create a rollup column to sum related values
const totalSalesColumn = {
  id: 'total-sales',
  name: 'Total Sales',
  type: 'rollup',
  config: {
    relationColumnId: 'orders',      // Reference to a relation column
    targetColumnId: 'amount',        // Column to aggregate in related table
    aggregation: 'sum'               // Aggregation function
  }
};
```

**Aggregation functions:**
| Function | Description |
|----------|-------------|
| `sum` | Sum of all values |
| `average` | Average of all values |
| `count` | Count of related rows |
| `min` | Minimum value |
| `max` | Maximum value |
| `countValues` | Count of non-empty values |

## Views

The view system allows multiple visualizations of the same data. Each table can have multiple views that share the same underlying data but display it differently.

### View Types

| View | Description |
|------|-------------|
| `table` | Traditional spreadsheet grid view |
| `board` | Kanban-style board grouped by a select column |
| `calendar` | Calendar layout based on date columns |

### Creating and Switching Views

```tsx
import { useViews } from '@marlinjai/data-table-react';

function MyTableWithViews() {
  const { views, currentView, createView, setCurrentView } = useViews({ tableId: 'my-table' });

  const handleCreateBoardView = async () => {
    await createView({
      name: 'Project Board',
      type: 'board',
      config: {
        groupByColumnId: 'status'  // Group by a select column
      }
    });
  };

  return (
    <div>
      {/* View switcher */}
      <div className="view-tabs">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => setCurrentView(view.id)}
            className={currentView?.id === view.id ? 'active' : ''}
          >
            {view.name}
          </button>
        ))}
        <button onClick={handleCreateBoardView}>+ New Board View</button>
      </div>

      {/* Render active view */}
      <ViewRenderer view={activeView} />
    </div>
  );
}
```

### Board View

The Board View displays data as a Kanban board, with columns grouped by a select-type column (e.g., Status, Priority).

```tsx
import { BoardView } from '@marlinjai/data-table-react';

function ProjectBoard() {
  const { columns, rows, updateCell } = useTable({ tableId: 'projects' });

  return (
    <BoardView
      columns={columns}
      rows={rows}
      config={{
        groupByColumnId: 'status',     // Column to group by
        cardProperties: ['assignee', 'due-date'],
      }}
      onCellChange={updateCell}        // Also handles drag-and-drop moves
    />
  );
}
```

**Board View features:**
- Drag-and-drop cards between columns
- Customize card display fields
- Filter and sort within columns
- Collapse/expand columns

### Calendar View

The Calendar View displays rows on a calendar based on date column values.

```tsx
import { CalendarView } from '@marlinjai/data-table-react';

function EventCalendar() {
  const { columns, rows } = useTable({ tableId: 'events' });

  return (
    <CalendarView
      columns={columns}
      rows={rows}
      config={{
        dateColumnId: 'event-date',       // Column containing dates
        endDateColumnId: 'event-end',     // Optional: for multi-day events
      }}
      onRowClick={(row) => console.log('Clicked event', row.id)}
      onDayClick={(date, events) => console.log('Clicked day', date)}
    />
  );
}
```

**Calendar View features:**
- Month grid with prev/next/today navigation
- Multi-day event spanning with start/end dates
- Visual distinction for current day and out-of-month days
- Event and day click handlers
