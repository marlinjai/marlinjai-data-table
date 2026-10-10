---
title: Sub-items
description: Hierarchical rows with parent-child relationships
order: 5
summary: Documentation for the data-table sub-items feature supporting hierarchical row structures with parent-child relationships, similar to Notion's sub-items.
type: documentation
tags: [data-table, sub-items, hierarchical, parent-child]
projects: [data-table]
---

# Sub-items (Hierarchical Rows)

The data table supports hierarchical row structures where rows can have parent-child relationships, similar to Notion's sub-items feature.

## Overview

Sub-items allow you to create nested data structures within your tables. A row can be a "sub-item" of another row (its parent), creating a tree-like hierarchy.

```
Parent Row 1
├── Sub-item 1.1
├── Sub-item 1.2
│   └── Sub-item 1.2.1  (nested sub-item)
└── Sub-item 1.3
Parent Row 2
└── Sub-item 2.1
```

## Data Model

### Row Interface

Each row has an optional `parentRowId` field that references its parent row:

```typescript
interface Row {
  id: string;
  tableId: string;
  parentRowId?: string; // For sub-items/hierarchical rows
  cells: Record<string, CellValue>;
  computed?: Record<string, CellValue>;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- If `parentRowId` is `undefined` or not set, the row is a top-level (root) row
- If `parentRowId` is set to another row's ID, the row is a sub-item of that parent

## Configuration

Configure sub-items behavior through the `SubItemsConfig` interface:

```typescript
interface SubItemsConfig {
  enabled: boolean;
  displayMode?: 'nested' | 'flat';
  filterMode?: 'all' | 'parents' | 'subitems';
  collapsedParents?: string[];
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | - | Enable/disable sub-items feature |
| `displayMode` | `'nested' \| 'flat'` | `'nested'` | How to display the hierarchy |
| `filterMode` | `'all' \| 'parents' \| 'subitems'` | `'all'` | Which rows to show |
| `collapsedParents` | `string[]` | `[]` | IDs of collapsed parent rows |

### Display Modes

| Mode | Description |
|------|-------------|
| `nested` | Shows hierarchy with visual indentation. Parent rows have expand/collapse controls. |
| `flat` | Shows all rows at the same level, ignoring the hierarchy structure. |

### Filter Modes

| Mode | Description |
|------|-------------|
| `all` | Show all rows (both parents and sub-items) |
| `parents` | Show only top-level rows (rows without a parent) |
| `subitems` | Show only sub-items (rows that have a parent) |

## Creating Sub-items

When creating a row, specify the `parentRowId` to make it a sub-item:

```typescript
interface CreateRowInput {
  tableId: string;
  parentRowId?: string; // For creating sub-items
  cells?: Record<string, CellValue>;
}
```

### Example

```typescript
// Create a parent row
const parentRow = await adapter.createRow({
  tableId: 'my-table',
  cells: { title: 'Parent Task' }
});

// Create a sub-item
const subItem = await adapter.createRow({
  tableId: 'my-table',
  parentRowId: parentRow.id,  // This makes it a sub-item
  cells: { title: 'Child Task' }
});
```

## Querying Sub-items

The `RowQueryOptions` interface provides options for filtering rows by their hierarchy:

```typescript
interface RowQueryOptions {
  tableId: string;
  filters?: QueryFilter[];
  sorts?: SortConfig[];
  limit?: number;
  offset?: number;
  cursor?: string;
  includeArchived?: boolean;

  // Sub-items filtering
  parentRowId?: string | null;
  includeSubItems?: boolean;
}
```

### Query Options

| Option | Type | Description |
|--------|------|-------------|
| `parentRowId` | `string \| null \| undefined` | Filter by parent relationship |
| `includeSubItems` | `boolean` | Include all sub-items recursively |

### `parentRowId` Values

| Value | Result |
|-------|--------|
| `undefined` | Return all rows (default) |
| `null` | Return only top-level rows (no parent) |
| `string` (row ID) | Return only direct children of that row |

### Examples

```typescript
// Get all rows (including sub-items)
const allRows = await adapter.getRows({
  tableId: 'my-table'
});

// Get only top-level rows
const topLevelRows = await adapter.getRows({
  tableId: 'my-table',
  parentRowId: null
});

// Get children of a specific row
const childRows = await adapter.getRows({
  tableId: 'my-table',
  parentRowId: 'parent-row-id'
});

// Get all rows with their sub-items (recursive)
const rowsWithSubItems = await adapter.getRows({
  tableId: 'my-table',
  includeSubItems: true
});
```

## UI Behavior

### Nested Display Mode

When `displayMode: 'nested'`:

1. **Indentation**: Sub-items are visually indented based on their depth
2. **Expand/Collapse**: Parent rows show a chevron icon to expand/collapse their children
3. **Collapsed State**: Tracked via `collapsedParents` array in config

### Visual Structure

```
▼ Parent Row 1           [depth: 0]
    Sub-item 1.1         [depth: 1, indented]
    ▼ Sub-item 1.2       [depth: 1, has children]
        Sub-item 1.2.1   [depth: 2, more indented]
    Sub-item 1.3         [depth: 1]
▶ Parent Row 2           [depth: 0, collapsed]
```

### Missing Parents

A row whose parent is not among the rows passed to the table (filtered out, not matched by a
search, deleted) is drawn as a top-level row. The same holds for rows whose parent links run in a
circle. Every row is drawn exactly once; none disappears because the row above it is missing.

### In Grouped Tables

Since `@marlinjai/data-table-react` 0.6.0 a table with `groupConfig` nests sub-items too:

- Only top-level rows are sorted into groups. A sub-item is drawn under its parent, in the group
  the parent belongs to, whatever its own value in the grouped column is. It appears nowhere else.
- The number in a group header counts every row drawn in the group once, folded or not.
- Only top-level rows have the grip that drags a row into another group. Dropping a parent writes
  the grouped column of the parent only; its sub-items follow it and keep their own values.

### A Value Computed From the Children

`getSubItemSummary(row, children, column)` lets a parent show a value in a column in place of its
own cell, for example the sum of its children's amounts. It is asked for every row while sub-items
are enabled, with an empty list for a row without children; returning `undefined` shows the row's
own cell. The value is drawn read-only. It is never written and never part of `rows`.

```tsx
<TableView
  subItemsConfig={{ enabled: true }}
  getSubItemSummary={(row, children, column) =>
    column.id === amountColumnId && children.length > 0
      ? children.reduce((sum, child) => sum + Number(child.cells[amountColumnId] ?? 0), 0)
      : undefined
  }
/>
```

### Rows That Do Not Count

`isCountedRow(row)` leaves rows out of the number a group header shows and out of the footer
calculations. Use it when a parent only holds other rows and is not an item itself.

## Best Practices

1. **Limit Nesting Depth**: While technically unlimited, keep nesting to 2-3 levels for usability
2. **Use Flat Mode for Reports**: When exporting or filtering, `flat` mode shows all data uniformly
3. **Manage Collapsed State**: Store `collapsedParents` in view config for persistence
4. **Consider Performance**: Deep hierarchies with many nodes may impact rendering performance

## Related Documentation

- [Architecture - Sub-items Section](/projects/data-table/architecture#sub-items-hierarchical-rows)
- [API Reference](/projects/data-table/api)
