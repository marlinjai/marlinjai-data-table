# Data Table Package Rules

This document contains AI-friendly context and conventions for the `@marlinjai/data-table` monorepo.

## Project Overview

A **reusable, storage-agnostic Notion-like data table** npm package. Designed to work across multiple products (Receipt OCR, CMS, etc.) with pluggable database and file storage adapters.

## Package Structure

```
packages/
├── core/           # Types, interfaces, engines (no React dependency)
├── react/          # React components, hooks, providers
├── adapter-memory/ # In-memory adapter for testing/demos
├── adapter-d1/     # Cloudflare D1 adapter (planned)
└── demo/           # Demo app for development
```

## Key Patterns

### Adapter Pattern
- **DatabaseAdapter**: Interface for data persistence (Memory, D1, Supabase)
- **FileStorageAdapter**: Interface for file uploads (Storage Brain, S3)
- Adapters are injected via `DataTableProvider`

### Component Architecture
- **TableView**: Main table component (uses CSS variables for theming)
- **CellRenderer**: Routes to cell type components (TextCell, SelectCell, etc.)
- **Portals**: Dropdowns render via `createPortal` to `document.body` to avoid clipping

### CSS Theming
- All styles use CSS variables with `--dt-` prefix
- Dark mode: Auto via `prefers-color-scheme: dark`, manual via `.dark` class
- Consumers can override any variable in `:root`

### Formula Engine Pattern
- **Parser**: Tokenizes formula strings into tokens
- **AST**: Abstract Syntax Tree representation of formula
- **Evaluator**: Walks AST to compute values from row data
- Flow: `formula string → Parser → AST → Evaluator(row) → computed value`

### View System Pattern
- **View Types**: TableView (default), BoardView (kanban), CalendarView
- **ViewSwitcher**: Component to switch between view types
- **Multiple Views**: Each table can have multiple saved views with different configs
- Views store: type, filters, sorts, column visibility, grouping

### Drag-and-Drop Pattern
- Used in BoardView for card movement between columns
- Uses native HTML5 drag-and-drop API
- Events: `onDragStart`, `onDragOver`, `onDrop`
- State tracks: `draggedItem`, `dropTarget`

## Conventions

### Naming
- Components: PascalCase (`TableView.tsx`)
- View components: `BoardView`, `CalendarView`, `ViewSwitcher`
- Hooks: camelCase with `use` prefix (`useTable.ts`, `useViews.ts`)
- Engine classes: `FormulaEngine`, `RollupEngine`
- CSS classes: `dt-` prefix (`dt-cell`, `dt-header`)
- View CSS: `dt-board-*`, `dt-calendar-*`, `dt-view-switcher`
- CSS variables: `--dt-` prefix (`--dt-bg-primary`)

### State Management
- React context for global state (via `DataTableProvider`)
- Local state with `useState` for component-specific state
- No external state libraries (keep it simple)

### Type Safety
- All types defined in `@marlinjai/data-table-core`
- Strict TypeScript (`"strict": true`)
- Export all public types from package entry points

## Column Types

| Type | Value Type | Notes |
|------|------------|-------|
| `text` | `string` | Plain text |
| `number` | `number` | Numeric with format options |
| `date` | `string` (ISO) | Date/datetime |
| `boolean` | `boolean` | Checkbox |
| `select` | `string` (option ID) | Single select |
| `multi_select` | `string[]` (option IDs) | Multiple select |
| `url` | `string` | URL with optional preview |
| `file` | `FileReference[]` | File attachments (planned) |
| `formula` | computed | Computed values from formulas |
| `rollup` | computed | Aggregated values from related rows |
| `relation` | `string[]` (row IDs) | Links to rows in other tables |

## Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run demo
pnpm demo

# Watch mode for development
pnpm dev
```

## File Locations

| Purpose | Location |
|---------|----------|
| Core types | `packages/core/src/types.ts` |
| Database adapter interface | `packages/core/src/adapter.ts` |
| Formula engine | `packages/core/src/formula/` |
| Rollup engine | `packages/core/src/rollup/` |
| React components | `packages/react/src/components/` |
| View components | `packages/react/src/components/views/` |
| Relation components | `packages/react/src/components/relations/` |
| React hooks | `packages/react/src/hooks/` |
| View management hook | `packages/react/src/hooks/useViews.ts` |
| CSS styles | `packages/react/src/styles/` |
| Demo app | `demo/` |
