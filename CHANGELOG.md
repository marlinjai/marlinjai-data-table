# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`@marlinjai/data-table-react`** 0.10.0: `moveRowsDisabled` on `TableView` pauses `onMoveRows`: the grips leave, the column stays, so the table does not shift. A row's grip now has its own slot beside the checkbox instead of lying on top of the cell: the selection column is 56px wide when the rows have grips (40px on a touch screen, where rows cannot be dragged), the checkboxes of the header and the rows line up, and the grip's dots are evenly spaced.
- **`@marlinjai/data-table-react`** 0.9.0: `onMoveRows`, `canHoldRows` and `rowGripLabel` on `TableView`. Every row that is no
  parent gets a grip, sub-items too, and moves by dragging: onto a parent or one of its sub-items to lie under it, onto
  the section around them to leave its parent, the selection along with it. A selected row shows its grip without hovering.
- **`@marlinjai/data-table-react`** 0.8.0: `onFoldAll` on `TableView`. With it, "Collapse all" and "Expand all" in a grouped
  table with sub-items fold the parents along with the sections, in one call, so the consumer
  stores both in one write. Without it the control folds sections only, as before.

### Fixed

- Prisma adapter 0.2.3 serializes duplicate-name checks and physical column creation,
  keeps row reads valid after schema edits, propagates database failures, and rejects
  unknown cell identifiers before mutations.
- Repaired the Prisma integration tests for the current adapter interface and added
  a required PostgreSQL test workflow with disposable-database safeguards.

### Deprecated

- **`@marlinjai/data-table-adapter-data-brain`** — Use `adapter-d1` or `adapter-prisma` directly. Data Brain service is being archived; all consumers have been migrated to direct adapter usage.

## [react-0.7.1] - 2026-10-26

### Fixed

- **`@marlinjai/data-table-react`** `useTable` loads the options of every select and multi-select column at once instead of one after another, and never asks again for a column that is loaded or on its way. Before, each answer re-ran the loader with an old copy of the options, so the same columns were asked for again (six extra requests in a row on the receipts dashboard). A table switch starts afresh and drops late answers for the old table
- **`@marlinjai/data-table-react`** a failed option load no longer goes unnoticed or stops the other columns: the column stays unloaded and is asked again on the next change

### Added

- **`@marlinjai/data-table-react`** `useTable` returns `selectOptionsError`, the last failed option load. `loadSelectOptions` stays an explicit reload: it always fetches, its answer wins over an older one still on its way, and it rejects on failure

## [react-0.7.0] - 2026-10-11

### Added

- **`@marlinjai/data-table-react`** `getSubItemSummaryNote(row, children, column)`: a short note next to a value from `getSubItemSummary`, for a summary that does not cover every child ("1 of 2"). Drawn muted beside the value, only where a value is shown
- **`@marlinjai/data-table-react`** grouped tables fold and unfold all groups at once: a "Collapse all" / "Expand all" control above the first group, shown when the consumer passes `onGroupConfigChange` and there is more than one group. It writes `collapsedGroups` in one change, so the state is stored like a single fold
- **`@marlinjai/data-table-react`** `FilterBar` takes `bare`: no padding, background, border or shadow of its own, for a host that places the bar inside its own toolbar

## [react-0.6.0] - 2026-10-11

### Added

- **`@marlinjai/data-table-react`** grouped tables nest sub-items: with `subItemsConfig.enabled` a child row is drawn under its parent, in the group the parent belongs to, and nowhere else. Parents fold and unfold as in the plain table. The number in a group header counts every row of the group once, folded or not
- **`@marlinjai/data-table-react`** `getSubItemSummary(row, children, column)`: a parent can show a value computed from its direct children in place of its own cell (a sum, for example). Display only and read-only: the value is never written and never part of `rows`
- **`@marlinjai/data-table-react`** `isCountedRow(row)`: rows that only hold other rows can be left out of the group header counts and the footer calculations
- **`@marlinjai/data-table-react`** exports `buildRowTree`, `flattenRowTree` and `descendantsOf`
- **`@marlinjai/data-table-react`** the fold button of a parent row says its state (`aria-expanded`) and has a label

### Changed

- **`@marlinjai/data-table-react`** dragging between groups with sub-items enabled: only top-level rows have the grip. Dropping a parent writes the grouped column of the parent only; its children follow it and keep their own values. From a selection, only the top-level rows are written

### Fixed

- **`@marlinjai/data-table-react`** a row whose parent is not among the rows (filtered out, not matched by a search, deleted) was not drawn at all. It is now a top-level row, and so are rows whose parent links run in a circle
- **`@marlinjai/data-table-react`** `subItemsConfig.collapsedParents` is compared by content: a consumer that builds the list on every render no longer resets what the user folded

## [react-0.5.0] - 2026-10-10

### Added

- **`@marlinjai/data-table-react`** grouped tables: a row can be dragged from one group into another by a grip that appears on the row. The drop writes the grouped column through `onCellChange`, exactly as editing the cell would (select, multi-select, text, url, number and checkbox columns; a multi-select row swaps the option of the group it left). Dragging one of several selected rows takes the selection along. No grip when the table is read-only, has no `onCellChange`, or groups by a date or a computed column
- **`@marlinjai/data-table-react`** the column resize handle is wider (9px, drawn as a 3px line on hover), keeps the resize cursor while dragging, and answers the arrow keys when focused (10px a step, 40px with Shift)
- **`@marlinjai/data-table-react`** exports `valueForGroupMove`, `canMoveBetweenGroups` and `EMPTY_GROUP_KEY`
- The React package has tests now (`pnpm --filter @marlinjai/data-table-react test`, vitest with jsdom)

### Fixed

- **`@marlinjai/data-table-react`** grouped tables had a reduced header: no column resize handle, no sorting, no alignment menu, no reordering. Every group's table now renders the same header cell as the plain table, and has the missing header cell above the "add property" column
- **`@marlinjai/data-table-react`** `onColumnResize` reported the width the column had when the drag started instead of the width on release, so a resized column fell back to its old width on the next load. A click on the handle without movement no longer reports anything

## [react-0.4.1] - 2026-07-24

### Fixed

- **`@marlinjai/data-table-react`** — single-click cell editing: activating a cell no longer blurs the editor that the same click opened (text/number cells needed a second click to edit); keyboard handler now treats any focused input inside the grid as editing, so arrows move the caret, not the cell focus

## [react-0.4.0] - 2026-07-24

### Added

- **`@marlinjai/data-table-react`** — Notion-style keyboard row selection in `TableView`
  - Shift+ArrowUp/Down extends a contiguous row selection anchored at the keyboard-focused row; plain navigation clears the anchor
  - New `onActiveRowChange(rowId | null)` callback so consumers can treat the focused row as an implicit single-row selection for bulk actions
  - The focused row is highlighted via the new `--dt-bg-row-active` theme variable (light + dark values shipped; checkbox selection still wins)

## [0.4.0] - 2026-03-22

### Added

- **`@marlinjai/data-table-adapter-shared`** — New shared utilities package for database adapters
  - Identifier sanitization (`safeTableName`, `safeColumnName`, `validateIdentifier`)
  - Type mapping between column types and SQL storage (`serializeCell`, `deserializeCell`)
  - Query builder with CAST expressions for PostgreSQL and SQLite (`buildWhereClause`, `buildOrderBy`)
  - DDL capability detection for PostgreSQL, SQLite, and D1
  - Schema self-healing (verify and repair metadata/table drift)
  - Batch loading utilities for junction table data (files, relations, multi-select)
- **`@marlinjai/data-table-adapter-prisma`** — New Prisma-based PostgreSQL adapter with real table columns
  - All 41 `DatabaseAdapter` methods implemented
  - Stores scalar cell values as TEXT columns in per-table SQL tables (not JSON blobs)
  - Type-aware filtering and sorting with CAST expressions
  - Eager loading via `include` parameter (files, relations, multiSelect)
  - Transactional DDL (CREATE TABLE, ALTER TABLE ADD/DROP COLUMN)
  - Lazy per-table migration from JSON blobs to real columns
  - Formula computation via FormulaEngine (post-query)
  - Rollup computation via RollupEngine (SQL JOIN + aggregate)
- **`include` on `QueryOptions`** — Optional `include: ('files' | 'relations' | 'multiSelect')[]` for eager-loading junction table data in `getRows()`
- **`migrated` on `Table`** — Boolean flag indicating whether a table has been migrated from JSON blobs to real columns
- **D1 adapter DDL compatibility** — Table-rebuild fallback for DROP COLUMN on D1, lazy migration module

### Fixed

- **PrismaAdapter ghost column bug** — Removed duplicate `addColumn` call in `createColumn` that created orphan SQL columns with random temp IDs

### Changed

- Migrated from npm workspaces to pnpm
- Root build script now includes `adapter-shared` and `adapter-prisma`

## [0.3.0] - 2026-02-28

### Added

- **Liquid Glass UI** — Semi-transparent backgrounds with `backdrop-filter` blur, glass borders/shadows, and refined typography across all components (table, dropdowns, popovers, tags, filter bar)
- **Keyboard cell navigation** — Arrow keys, Tab, Enter/Escape for navigating and editing cells in TableView. Enabled by default via `enableKeyboardNav` prop
- **Column alignment** — Right-click context menu to set text alignment (left/center/right) on any column. Managed as UI-only state via `onColumnAlignmentChange` prop
- **SVG view icons** — ViewSwitcher now uses proper SVG icons for table, board, calendar, gallery, timeline, and list views
- **Glass CSS variables** — New `--dt-glass-*` variables for blur, background, border, and shadow customization
- **Custom checkbox styling** — Glass-themed checkboxes with `appearance: none` and animated check marks
- **Floating glass group headers** — Group-by headers with `backdrop-filter` blur effect

### Fixed

- `crypto.randomUUID` fallback for non-secure contexts (HTTP, WebViews) — uses `Math.random` UUID v4 polyfill
- Single-click to edit text, number, date, and URL cells — previously required double-click
- `dist/` CSS paths added to package `exports` map for Turbopack compatibility

### Changed

- `@marlinjai/data-table-core` bumped to `0.2.0` — added `alignment` field to `UpdateColumnInput`
- `@marlinjai/data-table-react` bumped to `0.2.0`
- Dark mode backgrounds are now semi-transparent `rgba()` values for glass effect
- Tag colors in dark mode use semi-transparent backgrounds
- Default font changed to SF Pro system font stack
- Sizing increased: cell padding, row height, header height, border radius
- Border opacity increased for better visibility in dark mode

## [0.2.0] - 2026-02-20

### Added

- `@marlinjai/data-table-adapter-data-brain` — HTTP-backed DatabaseAdapter using Data Brain SDK
  - Drop-in replacement for D1/memory adapters when running client-side
  - Delegates all 43 DatabaseAdapter methods to Data Brain API via SDK
- **Auto-timestamp columns** — `created_time` and `last_edited_time` column types with automatic value management
- **Footer calculations** — Sum, average, count, min, max, and more aggregate functions displayed in a table footer row
- **Search within table** — Full-text search across all visible columns with highlight support
- **Board view enhancements** — Drag-and-drop reorder, collapsible columns, hide/show columns, sorting, and row detail panel
- **Text alignment** — Left/center/right alignment support on all cell components
- **Border configuration** — Configurable table border styles via `borderConfig` prop
- **Column alignment context menu** — Right-click column headers to set text alignment

### Fixed

- `@marlinjai/data-table-adapter-d1` — Added missing `dt_views` table to initial migration
- Footer calculations are now column-type aware — only applicable calculations shown per column type

### Changed

- Components refactored to use CSS variables for consistent theming
- Dark theme updated to neutral gray palette
- React peer dependency widened to include React 19

## [0.1.0] - 2026-01-11

### Added

- Initial release of Notion-like data table component library
- `@marlinjai/data-table-core` - Core types and interfaces
- `@marlinjai/data-table-react` - React components for data table UI
- `@marlinjai/data-table-adapter-d1` - Cloudflare D1 database adapter
- `@marlinjai/data-table-adapter-memory` - In-memory adapter for testing/development
- `@marlinjai/data-table-file-adapter-storage-brain` - File storage adapter
