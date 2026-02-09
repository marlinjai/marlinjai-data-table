---
title: Grouping
description: Group rows by select columns into collapsible sections
order: 4
---

# Grouping

The data table supports grouping rows by select or multi-select column values, creating collapsible sections for organizing related data.

## Overview

Grouping organizes rows into sections based on their value in a specified column. Each group can be expanded or collapsed, and shows a count of rows it contains.

```
┌─────────────────────────────────────────────┐
│ ▼ In Progress                          (5) │
│   Row 1                                     │
│   Row 2                                     │
│   Row 3                                     │
├─────────────────────────────────────────────┤
│ ▶ Done                                 (3) │
│   (collapsed)                               │
├─────────────────────────────────────────────┤
│ ▼ No Status                            (2) │
│   Row 7                                     │
│   Row 8                                     │
└─────────────────────────────────────────────┘
```

## Configuration

Grouping is configured through the view configuration:

```typescript
interface ViewConfig {
  filters?: FilterConfig[];
  sorts?: SortConfig[];
  hiddenColumns?: string[];
  groupByColumnId?: string; // Must be select or multi_select column
  // ... other view-specific configs
}
```

### Requirements

- The `groupByColumnId` must reference a `select` or `multi_select` column
- The column must exist in the table

## GroupHeader Component

The `GroupHeader` component renders the collapsible header for each group.

### Location

`packages/react/src/components/GroupHeader.tsx`

### Props

```typescript
interface GroupHeaderProps {
  /** The display label for the group */
  label: string;

  /** Number of rows in this group */
  rowCount: number;

  /** Whether the group is collapsed */
  isCollapsed: boolean;

  /** Callback when collapse state is toggled */
  onToggleCollapse: () => void;

  /** Number of columns to span (including selection, delete, add property columns) */
  colSpan: number;

  /** Optional className for custom styling */
  className?: string;
}
```

### Example Usage

```tsx
<GroupHeader
  label="In Progress"
  rowCount={5}
  isCollapsed={false}
  onToggleCollapse={() => toggleGroup('in-progress')}
  colSpan={columns.length + 2}
/>
```

## Features

### Collapsible Groups

Each group header is clickable and toggles between expanded and collapsed states:

- **Expanded (▼)**: Shows all rows in the group
- **Collapsed (▶)**: Hides all rows, showing only the header

### Row Count Badge

Each group header displays a badge showing the number of rows in that group, even when collapsed.

### "No Status" Group

Rows that don't have a value in the grouped column are collected into a special "No Status" group. This ensures no rows are hidden due to missing values.

### Visual Feedback

- Chevron icon rotates to indicate expand/collapse state
- Smooth transition animation (150ms)
- Distinct background color for group headers

## Using Grouping in Views

### Table View

```tsx
import { TableView } from '@marlinjai/data-table-react';

function MyGroupedTable() {
  return (
    <TableView
      columns={columns}
      rows={rows}
      viewConfig={{
        groupByColumnId: 'status'  // Group by the 'status' select column
      }}
      onCellChange={handleCellChange}
    />
  );
}
```

### Board View

The Board View uses grouping inherently - it groups by a select column to create Kanban lanes:

```tsx
import { BoardView } from '@marlinjai/data-table-react';

function MyKanbanBoard() {
  return (
    <BoardView
      columns={columns}
      rows={rows}
      boardConfig={{
        groupByColumnId: 'status',
        cardProperties: ['title', 'assignee', 'due_date']
      }}
      onCellChange={handleCellChange}
    />
  );
}
```

## Managing Collapsed State

To persist which groups are collapsed, track the collapsed group IDs in your view config or component state:

```tsx
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

const toggleGroup = (groupId: string) => {
  setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    return next;
  });
};
```

## Styling

### CSS Classes

| Class | Description |
|-------|-------------|
| `.dt-group-header` | Main group header row |

### Default Styles

The GroupHeader uses inline styles by default, but can be customized via the `className` prop:

```css
.my-custom-group-header {
  background-color: var(--dt-bg-secondary);
}

.my-custom-group-header:hover {
  background-color: var(--dt-bg-hover);
}
```

```tsx
<GroupHeader
  className="my-custom-group-header"
  // ... other props
/>
```

## Best Practices

1. **Use Meaningful Column Values**: Ensure your select/multi-select options have clear, descriptive labels
2. **Limit Options**: Too many groups can make the view hard to navigate
3. **Consider Sort Order**: Groups are displayed in the order of select options
4. **Handle Empty Values**: The "No Status" group appears for rows without a value - consider if this makes sense for your use case

## Related Documentation

- [Architecture - Grouping System](./architecture.md#grouping-system)
- [Board View](./architecture.md#boardview-kanban)
- [API Reference](./api.md)
