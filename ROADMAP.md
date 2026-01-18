# Roadmap

This document outlines the current implementation status and planned features for the `@marlinjai/data-table` package.

## Implemented Features

### Column Types (13)

| Type | Status | Description |
|------|--------|-------------|
| `text` | Complete | Plain text with max length, placeholder |
| `number` | Complete | Format options (currency, percent), precision |
| `date` | Complete | Timezone, format options |
| `boolean` | Complete | Checkbox |
| `select` | Complete | Single option, colored tags |
| `multi_select` | Complete | Multiple options, max selection |
| `url` | Complete | Link with preview |
| `file` | Complete | Upload, MIME type restrictions |
| `formula` | Complete | 50+ functions, AST caching |
| `relation` | Complete | Cross-table links, bidirectional |
| `rollup` | Complete | 14 aggregation types |
| `created_time` | Complete | Auto-populated on row creation |
| `last_edited_time` | Complete | Auto-updated on row edit |

### Views (3 of 6)

| View | Status | Description |
|------|--------|-------------|
| Table | Complete | Full spreadsheet functionality |
| Board | Complete | Kanban with drag-drop |
| Calendar | Complete | Month view, multi-day events |
| Gallery | Not started | Card-based image grid |
| Timeline | Not started | Gantt-style visualization |
| List | Not started | Simple list format |

### Core Features

| Feature | Status |
|---------|--------|
| Inline cell editing | Complete |
| Column resize & reorder | Complete |
| Single-column sorting | Complete |
| Filtering (FilterBar) | Complete |
| Grouping by select/multi-select | Complete |
| Sub-items (hierarchical rows) | Complete |
| Row selection | Complete |
| Board card drag-drop | Complete |
| ViewSwitcher component | Complete |
| CSS variable theming | Complete |
| Dark mode | Complete |
| Footer calculations | Complete |
| Search within table | Complete |

### Engines

| Engine | Status | Details |
|--------|--------|---------|
| Formula Engine | Complete | Lexer, recursive descent parser, AST evaluation, 50+ built-in functions |
| Rollup Engine | Complete | 14 aggregation types (count, sum, avg, min, max, etc.) |

### Database Adapters

| Adapter | Status | Description |
|---------|--------|-------------|
| Memory | Complete | In-memory for testing/demos |
| D1 | Complete | Cloudflare SQLite |
| Storage Brain File | Complete | File storage integration |

---

## Planned Features

### Medium Priority

#### 1. Gallery View
Card-based grid layout for visual content.
- Image-focused display
- Configurable card layout
- Cover image selection
- **Complexity**: Medium

#### 2. Multi-Column Sort
Sort by multiple columns with priority.
- Sort priority indicators
- Sort configuration panel
- **Complexity**: Low (logic exists, needs UI)

#### 3. Column Freeze
Sticky columns on horizontal scroll.
- Freeze leftmost columns
- Visual separator
- **Complexity**: Medium

#### 4. Advanced Filter UI
AND/OR filter group builder.
- Nested filter groups
- Visual filter builder
- **Complexity**: Medium

#### 5. Export Functionality
Export table data to various formats.
- CSV export
- JSON export
- Column selection
- **Complexity**: Low

#### 6. Import Functionality
Import data from files.
- CSV import with column mapping
- JSON import
- Validation and preview
- **Complexity**: Medium

### Lower Priority

#### 7. Status Column Type
Preset workflow stages column.
- Predefined stages (Not Started, In Progress, Done)
- Progress visualization
- **Complexity**: Medium

#### 8. Undo/Redo System
Command pattern for action history.
- Undo/redo stack
- Multi-action batching
- **Complexity**: High

#### 9. Timeline View
Gantt-style date visualization.
- Date range bars
- Drag to resize
- Dependencies (optional)
- **Complexity**: High

#### 10. List View
Simple list format display.
- Minimal chrome
- Mobile-friendly
- **Complexity**: Low

---

## Quality & Testing (Planned)

| Item | Priority | Notes |
|------|----------|-------|
| Unit tests for core | High | Formula engine, rollup engine, type utilities |
| Integration tests | Medium | Adapter implementations |
| E2E tests | Low | Demo app workflows |

---

## Reference

The `.notion_references/` folder contains 15 Notion UI screenshots used as design reference for feature implementation. These provide guidance for:
- Column type menus and configurations
- View layouts and interactions
- Property editors and pickers
