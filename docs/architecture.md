# Architecture

This document describes the architecture of the `@marlinjai/data-table` package.

## Package Structure

```
@marlinjai/data-table/
├── packages/
│   ├── core/                    # Core types, interfaces, engines
│   │   ├── src/
│   │   │   ├── types.ts         # All TypeScript interfaces
│   │   │   ├── db-adapter.ts    # DatabaseAdapter interface
│   │   │   ├── formula/         # Formula Engine
│   │   │   │   ├── FormulaParser.ts     # Lexer + recursive descent parser
│   │   │   │   ├── FormulaFunctions.ts  # 50+ built-in functions
│   │   │   │   ├── FormulaEngine.ts     # AST evaluation with caching
│   │   │   │   └── index.ts
│   │   │   ├── rollup/          # Rollup Engine
│   │   │   │   ├── RollupEngine.ts      # Aggregation calculator
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── react/                   # React components + hooks
│   │   ├── src/
│   │   │   ├── providers/       # DataTableProvider
│   │   │   ├── components/      # TableView, cells, filters
│   │   │   │   └── views/       # View-specific components
│   │   │   │       ├── ViewSwitcher.tsx  # View tab navigation
│   │   │   │       ├── BoardView.tsx     # Kanban board view
│   │   │   │       └── CalendarView.tsx  # Calendar grid view
│   │   │   ├── hooks/           # useTable, useColumns, useViews
│   │   │   └── styles/          # CSS variables + base styles
│   │   └── package.json
│   │
│   ├── adapter-memory/          # In-memory adapter
│   └── adapter-d1/              # Cloudflare D1 adapter (planned)
│
└── demo/                        # Demo application
```

## Design Patterns

### Adapter Pattern

The package uses the **Adapter Pattern** to decouple data storage from the UI layer:

```
┌─────────────────┐     ┌───────────────────┐
│   React Layer   │────▶│  DatabaseAdapter  │
│  (components)   │     │    (interface)    │
└─────────────────┘     └───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌──────────┐     ┌──────────┐     ┌──────────┐
       │  Memory  │     │    D1    │     │ Supabase │
       │ Adapter  │     │ Adapter  │     │ Adapter  │
       └──────────┘     └──────────┘     └──────────┘
```

**Benefits:**
- Test with in-memory adapter, deploy with D1/Supabase
- Easy to add new storage backends
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

## Database Schema

The adapter operates on these entities:

### Tables
```typescript
interface Table {
  id: string;
  workspaceId: string;
  name: string;
  icon?: string;
}
```

### Columns
```typescript
interface Column {
  id: string;
  tableId: string;
  name: string;
  type: ColumnType;
  position: number;
  width: number;
  config?: Record<string, unknown>;
}
```

### Rows
```typescript
interface Row {
  id: string;
  tableId: string;
  cells: Record<string, CellValue>; // columnId -> value
}
```

### Select Options
```typescript
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
                                                  │  (50+ built-ins) │
                                                  └──────────────────┘
```

### Components

| File | Responsibility |
|------|----------------|
| `FormulaParser.ts` | Lexer (tokenizer) + recursive descent parser producing AST |
| `FormulaFunctions.ts` | Registry of 50+ built-in functions (math, text, logic, date) |
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
│           (Memory, D1, Supabase, etc.)                          │
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
