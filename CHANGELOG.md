# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-02-28

### Added

- **Liquid Glass UI** — Semi-transparent backgrounds with `backdrop-filter` blur, glass borders/shadows, and refined typography across all components (table, dropdowns, popovers, tags, filter bar)
- **Keyboard cell navigation** — Arrow keys, Tab, Enter/Escape for navigating and editing cells in TableView. Enabled by default via `enableKeyboardNav` prop
- **Column alignment** — Right-click context menu to set text alignment (left/center/right) on any column. Managed as UI-only state via `onColumnAlignmentChange` prop
- **SVG view icons** — ViewSwitcher now uses proper SVG icons for table, board, calendar, gallery, timeline, and list views
- **Glass CSS variables** — New `--dt-glass-*` variables for blur, background, border, and shadow customization
- **Custom checkbox styling** — Glass-themed checkboxes with `appearance: none` and animated check marks

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

### Fixed

- `@marlinjai/data-table-adapter-d1` — Added missing `dt_views` table to initial migration

## [0.1.0] - 2026-01-11

### Added

- Initial release of Notion-like data table component library
- `@marlinjai/data-table-core` - Core types and interfaces
- `@marlinjai/data-table-react` - React components for data table UI
- `@marlinjai/data-table-adapter-d1` - Cloudflare D1 database adapter
- `@marlinjai/data-table-adapter-memory` - In-memory adapter for testing/development
- `@marlinjai/data-table-file-adapter-storage-brain` - File storage adapter
