# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Migrated from npm workspaces to pnpm

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
