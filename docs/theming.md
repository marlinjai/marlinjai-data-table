# Theming Guide

The data table is fully customizable via CSS variables, class names, and component props.

## CSS Variables

All CSS variables use the `--dt-` prefix. Override them in your CSS:

```css
:root {
  /* Change accent color to purple */
  --dt-accent-primary: #8b5cf6;
  --dt-accent-primary-hover: #7c3aed;

  /* Increase font size */
  --dt-font-size: 14px;

  /* Rounder corners */
  --dt-border-radius: 8px;
}
```

### Available Variables

#### Colors

| Variable | Default (Light) | Description |
|----------|-----------------|-------------|
| `--dt-bg-primary` | `#ffffff` | Main background |
| `--dt-bg-secondary` | `#f9fafb` | Header/toolbar background |
| `--dt-bg-hover` | `#f3f4f6` | Hover state |
| `--dt-bg-selected` | `#eff6ff` | Selected row |
| `--dt-border-color` | `#e5e7eb` | Border color |
| `--dt-text-primary` | `#111827` | Primary text |
| `--dt-text-secondary` | `#6b7280` | Secondary text |
| `--dt-text-muted` | `#9ca3af` | Muted text |
| `--dt-accent-primary` | `#2563eb` | Primary accent (links, focus) |
| `--dt-accent-danger` | `#ef4444` | Danger/delete |
| `--dt-accent-success` | `#16a34a` | Success |

#### Sizing

| Variable | Default | Description |
|----------|---------|-------------|
| `--dt-cell-padding-x` | `12px` | Horizontal cell padding |
| `--dt-cell-padding-y` | `8px` | Vertical cell padding |
| `--dt-header-height` | `36px` | Header row height |
| `--dt-row-height` | `32px` | Data row height |
| `--dt-border-radius` | `6px` | Border radius |
| `--dt-font-size` | `13px` | Base font size |

#### Select Tag Colors

Each color has a `-bg` and `-text` variant:

```css
--dt-tag-gray-bg, --dt-tag-gray-text
--dt-tag-red-bg, --dt-tag-red-text
--dt-tag-orange-bg, --dt-tag-orange-text
--dt-tag-yellow-bg, --dt-tag-yellow-text
--dt-tag-green-bg, --dt-tag-green-text
--dt-tag-blue-bg, --dt-tag-blue-text
--dt-tag-purple-bg, --dt-tag-purple-text
--dt-tag-pink-bg, --dt-tag-pink-text
--dt-tag-brown-bg, --dt-tag-brown-text
```

## Dark Mode

### Automatic (System Preference)

Dark mode automatically activates based on system preference:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --dt-bg-primary: #1f2937;
    /* ... other dark values */
  }
}
```

This is included by default in the package CSS.

### Manual Toggle

For manual dark mode control, add a class or data attribute to a parent element:

```html
<!-- Using class -->
<body class="dark">
  <DataTableProvider>...</DataTableProvider>
</body>

<!-- Using data attribute -->
<body data-theme="dark">
  <DataTableProvider>...</DataTableProvider>
</body>
```

Example toggle implementation:

```tsx
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <button onClick={() => setIsDark(!isDark)}>
      Toggle Dark Mode
    </button>
  );
}
```

## CSS Class Names

All components have stable class names for custom styling:

| Class | Component |
|-------|-----------|
| `.dt-table` | Main table container |
| `.dt-header` | Header row |
| `.dt-header-cell` | Header cell |
| `.dt-row` | Data row |
| `.dt-cell` | Data cell |
| `.dt-cell-text` | Text cell |
| `.dt-cell-number` | Number cell |
| `.dt-cell-select` | Select cell |
| `.dt-cell-multi-select` | Multi-select cell |
| `.dt-dropdown` | Dropdown menu |
| `.dt-popover` | Popover (edit options) |
| `.dt-filter-bar` | Filter bar |
| `.dt-tag` | Select tag |
| `.dt-tag-{color}` | Tag color variant |

### Relation Cell Classes

| Class | Component |
|-------|-----------|
| `.dt-relation-cell` | Container for relation cell |
| `.dt-relation-chip` | Individual relation chip/badge |
| `.dt-relation-picker` | Relation selection dropdown |

### View Switcher Classes

| Class | Component |
|-------|-----------|
| `.dt-view-switcher` | View switcher container |
| `.dt-view-tab` | Individual view tab |
| `.dt-view-tab-active` | Active view tab state |

### Board View Classes

| Class | Component |
|-------|-----------|
| `.dt-board-view` | Main board view container |
| `.dt-board-column` | Individual board column |
| `.dt-board-column-header` | Column header |
| `.dt-board-card` | Card item in column |
| `.dt-board-card-title` | Card title text |
| `.dt-board-card-property` | Property displayed on card |

### Calendar View Classes

| Class | Component |
|-------|-----------|
| `.dt-calendar-view` | Main calendar container |
| `.dt-calendar-header` | Calendar header (month/year nav) |
| `.dt-calendar-grid` | Calendar day grid |
| `.dt-calendar-day` | Individual day cell |
| `.dt-calendar-day-current` | Current day highlight |
| `.dt-calendar-event` | Event item on calendar |

### Formula & Rollup Cell Classes

| Class | Component |
|-------|-----------|
| `.dt-cell-formula` | Formula cell display |
| `.dt-cell-rollup` | Rollup cell display |

Example override:

```css
/* Make headers bold and uppercase */
.dt-header-cell {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Custom row hover color */
.dt-row:hover {
  background-color: #fef3c7 !important;
}
```

## Component Props

TableView and other components accept `className` and `style` props:

```tsx
<TableView
  className="my-custom-table"
  style={{ maxHeight: '500px', border: '2px solid #000' }}
  columns={columns}
  rows={rows}
  onCellChange={updateCell}
/>
```

## Complete Dark Theme Example

```css
/* Custom dark theme */
.my-dark-theme {
  --dt-bg-primary: #0a0a0a;
  --dt-bg-secondary: #171717;
  --dt-bg-hover: #262626;
  --dt-bg-selected: #1e3a5f;
  --dt-border-color: #262626;
  --dt-text-primary: #fafafa;
  --dt-text-secondary: #a1a1aa;
  --dt-text-muted: #71717a;
  --dt-accent-primary: #3b82f6;
  --dt-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
}
```

Apply it:

```html
<div class="my-dark-theme">
  <DataTableProvider>...</DataTableProvider>
</div>
```

## Styling New Components

### Relation Cell

The relation cell displays linked records as interactive chips. Customize appearance and behavior:

```css
/* Relation cell container */
.dt-relation-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
}

/* Individual relation chips */
.dt-relation-chip {
  background-color: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border-color);
  border-radius: var(--dt-border-radius);
  padding: 2px 8px;
  font-size: 12px;
  color: var(--dt-text-primary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dt-relation-chip:hover {
  background-color: var(--dt-bg-hover);
  border-color: var(--dt-accent-primary);
}

/* Relation picker dropdown */
.dt-relation-picker {
  background-color: var(--dt-bg-primary);
  border: 1px solid var(--dt-border-color);
  border-radius: var(--dt-border-radius);
  box-shadow: var(--dt-shadow-md);
  max-height: 300px;
  overflow-y: auto;
}
```

### View Switcher

The view switcher allows toggling between table, board, and calendar views:

```css
/* View switcher container */
.dt-view-switcher {
  display: flex;
  gap: 2px;
  background-color: var(--dt-bg-secondary);
  border-radius: var(--dt-border-radius);
  padding: 4px;
}

/* Individual view tabs */
.dt-view-tab {
  padding: 6px 12px;
  border-radius: calc(var(--dt-border-radius) - 2px);
  font-size: var(--dt-font-size);
  color: var(--dt-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dt-view-tab:hover {
  color: var(--dt-text-primary);
  background-color: var(--dt-bg-hover);
}

/* Active tab state */
.dt-view-tab-active {
  color: var(--dt-text-primary);
  background-color: var(--dt-bg-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 500;
}
```

### Board View (Kanban)

The board view displays data in a kanban-style layout with draggable cards:

```css
/* Main board container */
.dt-board-view {
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  min-height: 400px;
  background-color: var(--dt-bg-secondary);
}

/* Individual columns */
.dt-board-column {
  flex-shrink: 0;
  width: 280px;
  background-color: var(--dt-bg-primary);
  border-radius: var(--dt-border-radius);
  border: 1px solid var(--dt-border-color);
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

/* Column headers */
.dt-board-column-header {
  padding: 12px;
  font-weight: 600;
  font-size: var(--dt-font-size);
  color: var(--dt-text-primary);
  border-bottom: 1px solid var(--dt-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Card items */
.dt-board-card {
  margin: 8px;
  padding: 12px;
  background-color: var(--dt-bg-primary);
  border: 1px solid var(--dt-border-color);
  border-radius: var(--dt-border-radius);
  cursor: grab;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.dt-board-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dt-board-card:active {
  cursor: grabbing;
  transform: rotate(2deg);
}

/* Card title */
.dt-board-card-title {
  font-weight: 500;
  font-size: var(--dt-font-size);
  color: var(--dt-text-primary);
  margin-bottom: 8px;
}

/* Card properties */
.dt-board-card-property {
  font-size: 12px;
  color: var(--dt-text-secondary);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

### Calendar View

The calendar view displays date-based data in a monthly grid:

```css
/* Main calendar container */
.dt-calendar-view {
  background-color: var(--dt-bg-primary);
  border: 1px solid var(--dt-border-color);
  border-radius: var(--dt-border-radius);
  overflow: hidden;
}

/* Calendar header with navigation */
.dt-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--dt-bg-secondary);
  border-bottom: 1px solid var(--dt-border-color);
  font-weight: 600;
  color: var(--dt-text-primary);
}

/* Calendar grid */
.dt-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: var(--dt-border-color);
}

/* Individual day cells */
.dt-calendar-day {
  min-height: 100px;
  padding: 8px;
  background-color: var(--dt-bg-primary);
  font-size: 12px;
}

.dt-calendar-day:hover {
  background-color: var(--dt-bg-hover);
}

/* Current day highlight */
.dt-calendar-day-current {
  background-color: var(--dt-bg-selected);
  position: relative;
}

.dt-calendar-day-current::before {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background-color: var(--dt-accent-primary);
  border-radius: 50%;
  z-index: 0;
}

/* Events on calendar */
.dt-calendar-event {
  margin-top: 4px;
  padding: 4px 6px;
  background-color: var(--dt-accent-primary);
  color: white;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-calendar-event:hover {
  opacity: 0.9;
}
```

### Formula & Rollup Cells

Formula and rollup cells display computed values with distinct styling:

```css
/* Formula cell */
.dt-cell-formula {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--dt-text-primary);
  background-color: var(--dt-bg-secondary);
  padding: var(--dt-cell-padding-y) var(--dt-cell-padding-x);
  position: relative;
}

/* Optional: Add formula indicator icon */
.dt-cell-formula::before {
  content: 'fx';
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 9px;
  color: var(--dt-text-muted);
  font-style: italic;
}

/* Rollup cell */
.dt-cell-rollup {
  font-size: var(--dt-font-size);
  color: var(--dt-text-secondary);
  background-color: var(--dt-bg-secondary);
  padding: var(--dt-cell-padding-y) var(--dt-cell-padding-x);
}

/* Rollup aggregation badge */
.dt-cell-rollup::after {
  content: attr(data-aggregation);
  margin-left: 6px;
  font-size: 10px;
  color: var(--dt-text-muted);
  text-transform: uppercase;
}
```

## Importing Styles

The styles are bundled with the package. Import them in your app:

```tsx
// Option 1: Import in your main entry file
import '@marlinjai/data-table-react/styles';

// Option 2: Import in CSS
@import '@marlinjai/data-table-react/styles/base.css';
```

Or copy `variables.css` and customize it in your project.
