import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type { Column, Row, CellValue, SelectOption, QuerySort, ColumnType, FileReference, SubItemsConfig, GroupConfig, FooterConfig, BorderConfig, TextAlignment } from '@marlinjai/data-table-core';
import { CellRenderer } from './cells/CellRenderer';
import { GroupHeader } from './GroupHeader';
import { TableFooter } from './TableFooter';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';
import { useGrouping, canMoveBetweenGroups, valueForGroupMove } from '../hooks/useGrouping';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { buildRowTree, flattenRowTree, descendantsOf } from '../hooks/rowTree';

const NO_CHILDREN = new Map<string, Row[]>();

/** The section key of a table without sections. */
const UNGROUPED = '\0ungrouped';

/** What a drag carries. */
interface RowDrag {
  /** Top-level rows: a section move writes these, their sub-items follow. */
  rowIds: string[];
  followIds: string[];
  /** The rows that can change parent. */
  movableIds: string[];
  /** Of those, the ones that lie under a parent now. */
  nestedIds: string[];
  sourceKey: string;
}

export interface TableViewProps {
  columns: Column[];
  rows: Row[];
  selectOptions?: Map<string, SelectOption[]>;

  // Cell editing
  onCellChange?: (rowId: string, columnId: string, value: CellValue) => void;
  readOnly?: boolean;

  // Row actions
  onAddRow?: () => void;
  onDeleteRow?: (rowId: string) => void;

  // Column actions
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columnId: string, newPosition: number) => void;
  onAddProperty?: (name: string, type: ColumnType) => void;
  columnOrder?: string[];

  // Select option management
  onCreateSelectOption?: (columnId: string, name: string, color?: string) => Promise<SelectOption>;
  onUpdateSelectOption?: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  onDeleteSelectOption?: (columnId: string, optionId: string) => Promise<void>;

  // File operations
  onUploadFile?: (rowId: string, columnId: string, file: File) => Promise<FileReference>;
  onDeleteFile?: (rowId: string, columnId: string, fileId: string) => Promise<void>;

  // Relation operations
  onSearchRelationRows?: (tableId: string, query: string) => Promise<Row[]>;
  onGetRelationRowTitle?: (tableId: string, rowId: string) => Promise<string>;

  // Sorting
  sorts?: QuerySort[];
  onSortChange?: (sorts: QuerySort[]) => void;

  // Selection
  selectedRows?: Set<string>;
  onSelectionChange?: (selectedRows: Set<string>) => void;
  /**
   * Fires whenever the keyboard-focused row changes (the row of the active
   * cell), with `null` when focus leaves the grid. Lets consumers treat the
   * focused row as an implicit single-row selection (Notion-style) for bulk
   * actions without requiring a checkbox tick.
   */
  onActiveRowChange?: (rowId: string | null) => void;

  // Loading states
  isLoading?: boolean;

  // Pagination
  hasMore?: boolean;
  onLoadMore?: () => void;

  // Sub-items / Hierarchical rows
  subItemsConfig?: SubItemsConfig;
  onExpandRow?: (rowId: string) => void;
  onCollapseRow?: (rowId: string) => void;
  /**
   * "Collapse all" and "Expand all" in a grouped table with sub-items. Called
   * once with the whole new fold state, sections and parents together, so the
   * consumer stores it in one write. Without it the control folds sections only.
   */
  onFoldAll?: (state: { collapsedGroups: string[]; collapsedParents: string[] }) => void;
  onCreateSubItem?: (parentRowId: string) => void;
  /**
   * Move rows under another parent by dragging them by their grip, sub-items
   * included. Dropped on a parent row, or on one of its sub-items, `parentRowId`
   * is that parent; dropped on the section around them, it is null and the rows
   * are top-level rows again. Without it a sub-item has no grip.
   */
  onMoveRows?: (rowIds: string[], parentRowId: string | null) => void;
  /** Pause `onMoveRows` for a moment: the grips leave, the column they sit in stays. */
  moveRowsDisabled?: boolean;
  /**
   * Which rows can hold others. Defaults to the rows that have sub-items; pass it
   * when a parent can be told apart otherwise, so one whose sub-items are all
   * filtered out still takes a drop. A row that can hold others is never moved
   * under another, so parents do not nest.
   */
  canHoldRows?: (row: Row) => boolean;
  /** Tooltip and accessible name of a row's grip. */
  rowGripLabel?: string;
  /**
   * A value a parent row shows in a column in place of its own cell, computed
   * from its direct children (a sum of their amounts, for example). Asked for
   * every row while sub-items are enabled, with an empty list for a row without
   * children; return `undefined` to show the row's own cell. The value is only
   * drawn, read-only: it is never written and never part of `rows`.
   */
  getSubItemSummary?: (row: Row, children: Row[], column: Column) => CellValue | undefined;
  /**
   * A short note shown next to a value from `getSubItemSummary`, for a summary
   * that does not cover every child ("1 of 2", for example). Only asked where
   * `getSubItemSummary` returned a value; return `undefined` for no note.
   */
  getSubItemSummaryNote?: (row: Row, children: Row[], column: Column) => string | undefined;
  /**
   * Whether a row counts in the number a group header shows and in the footer
   * calculations. Defaults to every row. Lets a row that only holds others stay
   * out of the counts.
   */
  isCountedRow?: (row: Row) => boolean;

  // Grouping
  groupConfig?: GroupConfig;
  onGroupConfigChange?: (config: GroupConfig | undefined) => void;
  onToggleGroupCollapse?: (groupValue: string) => void;

  // Footer calculations
  footerConfig?: FooterConfig;
  onFooterConfigChange?: (config: FooterConfig) => void;
  showFooter?: boolean;

  // Border configuration
  /** Configure table border visibility */
  borderConfig?: BorderConfig;

  // Column alignment
  /** Called when column alignment changes via context menu */
  onColumnAlignmentChange?: (columnId: string, alignment: TextAlignment) => void;

  // Row open action
  /** Called when the user clicks the "OPEN" button on a row. Shows a hover button in the primary column. */
  onRowOpen?: (row: Row) => void;

  // Keyboard navigation
  /** Enable keyboard cell navigation (arrow keys, Enter to edit, Tab to move). Defaults to true. */
  enableKeyboardNav?: boolean;

  // Styling
  className?: string;
  style?: React.CSSProperties;
}

/** A column is never dragged narrower than this. */
const MIN_COLUMN_WIDTH = 80;

const COLUMN_TYPES: { value: ColumnType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: 'Aa' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'boolean', label: 'Checkbox', icon: '☑' },
  { value: 'select', label: 'Select', icon: '▼' },
  { value: 'multi_select', label: 'Multi-select', icon: '▼▼' },
  { value: 'url', label: 'URL', icon: '🔗' },
  { value: 'file', label: 'Files & media', icon: '📎' },
  { value: 'formula', label: 'Formula', icon: 'ƒ' },
  { value: 'relation', label: 'Relation', icon: '↔' },
  { value: 'rollup', label: 'Rollup', icon: '∑' },
  { value: 'created_time', label: 'Created time', icon: '🕐' },
  { value: 'last_edited_time', label: 'Last edited time', icon: '✏️' },
];

export function TableView({
  columns,
  rows,
  selectOptions = new Map(),
  onCellChange,
  readOnly = false,
  onAddRow,
  onDeleteRow,
  onColumnResize,
  onColumnReorder,
  onAddProperty,
  columnOrder,
  onCreateSelectOption,
  onUpdateSelectOption,
  onDeleteSelectOption,
  onUploadFile,
  onDeleteFile,
  onSearchRelationRows,
  onGetRelationRowTitle,
  sorts = [],
  onSortChange,
  selectedRows = new Set(),
  onSelectionChange,
  onActiveRowChange,
  isLoading,
  hasMore,
  onLoadMore,
  subItemsConfig,
  onExpandRow,
  onCollapseRow,
  onFoldAll,
  onMoveRows,
  moveRowsDisabled = false,
  canHoldRows,
  rowGripLabel = 'Drag to move',
  onCreateSubItem,
  getSubItemSummary,
  getSubItemSummaryNote,
  isCountedRow,
  groupConfig,
  onGroupConfigChange,
  onToggleGroupCollapse,
  footerConfig,
  onFooterConfigChange,
  showFooter = true,
  borderConfig,
  onColumnAlignmentChange,
  onRowOpen,
  enableKeyboardNav = true,
  className,
  style,
}: TableViewProps) {
  // Default alignment based on column type
  const getDefaultAlignment = (type: ColumnType): TextAlignment => {
    if (type === 'number') return 'right';
    if (type === 'boolean') return 'center';
    return 'left';
  };

  // Compute border styles for cells
  const getCellBorderStyles = (isLastColumn: boolean): React.CSSProperties => {
    const borderStyle = borderConfig?.style ?? 'both';
    const color = borderConfig?.borderColor ?? 'var(--dt-border-color)';
    const showRows = borderStyle === 'rows' || borderStyle === 'both';
    const showCols = borderStyle === 'columns' || borderStyle === 'both';

    return {
      borderBottom: showRows ? `1px solid ${color}` : 'none',
      borderRight: showCols && !isLastColumn ? `1px solid ${color}` : 'none',
    };
  };
  // Local expanded state (used when subItemsConfig is provided but collapsedParents is managed internally)
  const [localCollapsedParents, setLocalCollapsedParents] = useState<Set<string>>(
    () => new Set(subItemsConfig?.collapsedParents ?? [])
  );

  // Sync localCollapsedParents with subItemsConfig.collapsedParents when its content changes.
  // Compared by content: a consumer that builds the list on every render must not reset the state each time.
  const collapsedParentsKey = subItemsConfig?.collapsedParents?.join('\u0000');
  useEffect(() => {
    if (subItemsConfig?.collapsedParents) {
      setLocalCollapsedParents(new Set(subItemsConfig.collapsedParents));
    }
  }, [collapsedParentsKey]);

  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    columns.forEach((col) => map.set(col.id, col.width));
    return map;
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<ColumnType>('text');
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{
    columnId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isEditingCell, setIsEditingCell] = useState(false);
  const activeCellInitialized = useRef(false);
  // Anchor row index for Shift+Arrow range selection (Notion-style): set on the
  // first Shift+Arrow from the focused row, cleared by any plain navigation.
  const selectionAnchorRef = useRef<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  // The width under the pointer right now. State would be one render behind when the mouse is released.
  const resizeCurrentWidth = useRef(0);
  // Dragging rows between groups: the row whose grip is held, the rows on the move, the group under them.
  const [armedRowId, setArmedRowId] = useState<string | null>(null);
  const [rowDrag, setRowDrag] = useState<RowDrag | null>(null);
  // The section under the dragged rows; `UNGROUPED` is the body of a table without sections.
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  // The parent row that takes the drop, whichever of its rows is under the pointer.
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

  // Sort columns based on columnOrder prop if provided
  const orderedColumns = useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) {
      return columns;
    }

    const columnMap = new Map(columns.map((col) => [col.id, col]));
    const ordered: Column[] = [];

    // Add columns in the specified order
    for (const id of columnOrder) {
      const col = columnMap.get(id);
      if (col) {
        ordered.push(col);
        columnMap.delete(id);
      }
    }

    // Add any remaining columns not in the order
    for (const col of columnMap.values()) {
      ordered.push(col);
    }

    return ordered;
  }, [columns, columnOrder]);

  // Rows arranged by parent. Without sub-items every row is a top-level row.
  const subItemsEnabled = !!subItemsConfig?.enabled;
  const { topLevelRows, rowChildrenMap } = useMemo(() => {
    if (!subItemsEnabled) return { topLevelRows: rows, rowChildrenMap: NO_CHILDREN };
    const tree = buildRowTree(rows);
    return { topLevelRows: tree.roots, rowChildrenMap: tree.childrenOf };
  }, [rows, subItemsEnabled]);

  const flattenedRows = useMemo(
    () => flattenRowTree(topLevelRows, rowChildrenMap, localCollapsedParents),
    [topLevelRows, rowChildrenMap, localCollapsedParents]
  );

  // Toggle expand/collapse for a row
  const handleToggleExpand = useCallback(
    (rowId: string) => {
      const isCurrentlyCollapsed = localCollapsedParents.has(rowId);

      if (isCurrentlyCollapsed) {
        // Expand
        setLocalCollapsedParents((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
        onExpandRow?.(rowId);
      } else {
        // Collapse
        setLocalCollapsedParents((prev) => new Set(prev).add(rowId));
        onCollapseRow?.(rowId);
      }
    },
    [localCollapsedParents, onExpandRow, onCollapseRow]
  );

  // Drag and drop for column reordering
  const {
    isDragging,
    getDragProps,
    isItemDragging,
    isDropTarget,
    getDropPosition,
  } = useDragAndDrop({
    items: orderedColumns,
    onReorder: onColumnReorder,
    isDisabled: !onColumnReorder || resizingColumn !== null,
  });

  // Grouping hook
  // Only top-level rows are sorted into groups: a child is drawn under its
  // parent, in the group the parent belongs to, so no row sits in a group twice.
  const { groups, isGrouped } = useGrouping({
    rows: topLevelRows,
    columns: orderedColumns,
    groupConfig,
    selectOptions,
  });

  // Handler for toggling group collapse
  const handleToggleGroupCollapse = useCallback(
    (groupValue: string) => {
      if (onToggleGroupCollapse) {
        onToggleGroupCollapse(groupValue);
      } else if (onGroupConfigChange && groupConfig) {
        // Fallback: manage collapse state via groupConfig
        const collapsedGroups = groupConfig.collapsedGroups ?? [];
        const isCollapsed = collapsedGroups.includes(groupValue);
        const newCollapsedGroups = isCollapsed
          ? collapsedGroups.filter((v) => v !== groupValue)
          : [...collapsedGroups, groupValue];
        onGroupConfigChange({
          ...groupConfig,
          collapsedGroups: newCollapsedGroups,
        });
      }
    },
    [onToggleGroupCollapse, onGroupConfigChange, groupConfig]
  );

  // Fold or unfold every group at once. Written through the group config, so
  // the consumer stores it like a single fold. With `onFoldAll` the parents fold
  // along. Parents not among the rows at hand keep their state.
  const allGroupsCollapsed = groups.length > 0 && groups.every((g) => g.isCollapsed);
  const handleFoldAllGroups = useCallback(
    (collapse: boolean) => {
      const collapsedGroups = collapse ? groups.map((g) => g.value) : [];
      if (onFoldAll) {
        const parents = [...rowChildrenMap.keys()];
        const collapsedParents = collapse
          ? [...new Set([...localCollapsedParents, ...parents])]
          : [...localCollapsedParents].filter((id) => !rowChildrenMap.has(id));
        setLocalCollapsedParents(new Set(collapsedParents));
        onFoldAll({ collapsedGroups, collapsedParents });
        return;
      }
      if (!onGroupConfigChange || !groupConfig) return;
      onGroupConfigChange({ ...groupConfig, collapsedGroups });
    },
    [onFoldAll, onGroupConfigChange, groupConfig, groups, rowChildrenMap, localCollapsedParents]
  );

  // Rows can be dragged from one group into another when the grouped column can be
  // written from a group's key. The drop writes that column, the same as editing the cell.
  const groupColumn = isGrouped ? orderedColumns.find((c) => c.id === groupConfig?.columnId) : undefined;
  const canDragRows = !!groupColumn && !readOnly && !!onCellChange && canMoveBetweenGroups(groupColumn.type);

  // The row is draggable only while its grip is held, so text in cells stays selectable.
  useEffect(() => {
    if (!armedRowId) return;
    const disarm = () => setArmedRowId(null);
    document.addEventListener('mouseup', disarm);
    return () => document.removeEventListener('mouseup', disarm);
  }, [armedRowId]);

  const endRowDrag = useCallback(() => {
    setArmedRowId(null);
    setRowDrag(null);
    setDragOverGroup(null);
    setDragOverRow(null);
  }, []);

  const canMoveRows = subItemsEnabled && !readOnly && !!onMoveRows && !moveRowsDisabled;
  // Space for the grips is kept on every row, so the table does not shift while they come and go.
  const hasRowGrips = canDragRows || (subItemsEnabled && !readOnly && !!onMoveRows);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const holdsRows = (row: Row) => (canHoldRows ? canHoldRows(row) : rowChildrenMap.has(row.id));
  const parentOf = (row: Row) => (row.parentRowId ? rowById.get(row.parentRowId) : undefined);

  /** The row that takes a drop on `row`: itself when it holds rows, else the parent it lies under. */
  const holderOf = (row: Row): Row | null => {
    if (holdsRows(row)) return row;
    const parent = parentOf(row);
    return parent && holdsRows(parent) ? parent : null;
  };

  /** Of the dragged rows, the ones a drop on `holder` would really move. */
  const idsMovingInto = (drag: RowDrag, holder: Row) =>
    drag.movableIds.filter((id) => rowById.get(id)?.parentRowId !== holder.id);

  const handleRowDragStart = (e: React.DragEvent, row: Row, sourceKey: string) => {
    if (armedRowId !== row.id) {
      e.preventDefault();
      return;
    }
    // Dragging one of several selected rows takes the whole selection along.
    const picked = selectedRows.has(row.id) ? rows.filter((r) => selectedRows.has(r.id)) : [row];
    const topLevel = new Set(topLevelRows.map((r) => r.id));
    // Only top-level rows are written: a child follows its parent into the new group.
    const rowIds = picked.filter((r) => topLevel.has(r.id)).map((r) => r.id);
    const followIds = rowIds.flatMap((id) => descendantsOf(id, rowChildrenMap).map((r) => r.id));
    // A parent held by its grip moves between sections only.
    const movable = canMoveRows && !holdsRows(row) ? picked.filter((r) => !holdsRows(r)) : [];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.id);
    setRowDrag({
      rowIds,
      followIds,
      movableIds: movable.map((r) => r.id),
      nestedIds: movable.filter((r) => !topLevel.has(r.id)).map((r) => r.id),
      sourceKey,
    });
  };

  /** Its own section takes sub-items out of their parent; another section takes every dragged row, when it can be written. */
  const sectionTakesDrop = (drag: RowDrag, groupKey: string) =>
    groupKey === drag.sourceKey ? drag.nestedIds.length > 0 : canDragRows && drag.rowIds.length + drag.nestedIds.length > 0;

  const handleGroupDragOver = (e: React.DragEvent, groupKey: string) => {
    if (!rowDrag || !sectionTakesDrop(rowDrag, groupKey)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroup !== groupKey) setDragOverGroup(groupKey);
  };

  const handleGroupDragLeave = (e: React.DragEvent, groupKey: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOverGroup((current) => (current === groupKey ? null : current));
    setDragOverRow(null);
  };

  const handleGroupDrop = (e: React.DragEvent, groupKey: string) => {
    if (!rowDrag || !sectionTakesDrop(rowDrag, groupKey)) return;
    e.preventDefault();
    if (groupColumn && groupKey !== rowDrag.sourceKey) {
      for (const rowId of [...rowDrag.rowIds, ...rowDrag.nestedIds]) {
        const row = rowById.get(rowId);
        if (!row) continue;
        const move = valueForGroupMove(groupColumn.type, row.cells[groupColumn.id], rowDrag.sourceKey, groupKey);
        if (move) onCellChange?.(rowId, groupColumn.id, move.value);
      }
    }
    if (rowDrag.nestedIds.length > 0) onMoveRows?.(rowDrag.nestedIds, null);
    endRowDrag();
  };

  // A row inside a section: a drop on a parent never reaches the section around it,
  // which would write the grouped column on top of the move.
  const handleRowDragOver = (e: React.DragEvent, row: Row) => {
    if (!rowDrag || rowDrag.movableIds.length === 0) return;
    const holder = holderOf(row);
    if (!holder) {
      setDragOverRow(null);
      return;
    }
    e.stopPropagation();
    setDragOverGroup(null);
    if (idsMovingInto(rowDrag, holder).length === 0) {
      setDragOverRow(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRow !== holder.id) setDragOverRow(holder.id);
  };

  const handleRowDrop = (e: React.DragEvent, row: Row) => {
    if (!rowDrag || rowDrag.movableIds.length === 0) return;
    const holder = holderOf(row);
    if (!holder) return;
    e.stopPropagation();
    const ids = idsMovingInto(rowDrag, holder);
    if (ids.length > 0) {
      e.preventDefault();
      onMoveRows?.(ids, holder.id);
    }
    endRowDrag();
  };

  /** A top-level row moves between sections; any row that is no parent itself can change parent. */
  const rowCanBeDragged = (row: Row, depth: number, groupKey: string | undefined) =>
    (canDragRows && groupKey !== undefined && depth === 0) || (canMoveRows && !holdsRows(row));

  const renderRowGrip = (rowId: string, draggable: boolean) => {
    if (!hasRowGrips) return null;
    if (!draggable) return <span className="dt-row-grip-slot" />;
    return (
      <span
        className="dt-row-grip-slot dt-row-grip"
        role="button"
        aria-label={rowGripLabel}
        title={rowGripLabel}
        onMouseDown={(e) => {
          e.stopPropagation();
          setArmedRowId(rowId);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor" style={{ display: 'block' }} aria-hidden="true">
          <circle cx="2" cy="1.5" r="1.25" />
          <circle cx="7" cy="1.5" r="1.25" />
          <circle cx="2" cy="6.5" r="1.25" />
          <circle cx="7" cy="6.5" r="1.25" />
          <circle cx="2" cy="11.5" r="1.25" />
          <circle cx="7" cy="11.5" r="1.25" />
        </svg>
      </span>
    );
  };

  /** The selection column: the checkbox, beside the grip's slot when the rows have grips. */
  const selectColumnClass = hasRowGrips ? 'dt-select-col dt-select-col-grips' : 'dt-select-col';
  const renderSelectControl = (grip: React.ReactNode, checkbox: React.ReactNode) => (
    <div className="dt-select-control">
      {grip}
      {checkbox}
    </div>
  );

  // Update widths when columns change
  useEffect(() => {
    setColumnWidths((prev) => {
      const map = new Map(prev);
      columns.forEach((col) => {
        if (!map.has(col.id)) {
          map.set(col.id, col.width);
        }
      });
      return map;
    });
  }, [columns]);

  const getColumnWidth = (columnId: string) => {
    return columnWidths.get(columnId) ?? 200;
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingColumn(columnId);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = getColumnWidth(columnId);
      resizeCurrentWidth.current = resizeStartWidth.current;
    },
    [columnWidths]
  );

  // Arrow keys on a focused resize handle: 10px a step, 40px with Shift.
  const handleResizeKey = useCallback(
    (e: React.KeyboardEvent, columnId: string) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const step = (e.shiftKey ? 40 : 10) * (e.key === 'ArrowLeft' ? -1 : 1);
      const next = Math.max(MIN_COLUMN_WIDTH, getColumnWidth(columnId) + step);
      setColumnWidths((prev) => new Map(prev).set(columnId, next));
      onColumnResize?.(columnId, next);
    },
    [columnWidths, onColumnResize]
  );

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + diff);
      resizeCurrentWidth.current = newWidth;
      setColumnWidths((prev) => new Map(prev).set(resizingColumn, newWidth));
    };

    const handleMouseUp = () => {
      if (resizingColumn && onColumnResize && resizeCurrentWidth.current !== resizeStartWidth.current) {
        onColumnResize(resizingColumn, resizeCurrentWidth.current);
      }
      setResizingColumn(null);
    };

    // The pointer leaves the thin handle at once, so the cursor is held on the page while resizing.
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, onColumnResize]);

  const handleCellChange = useCallback(
    (rowId: string, columnId: string, value: CellValue) => {
      onCellChange?.(rowId, columnId, value);
    },
    [onCellChange]
  );

  const handleSort = useCallback(
    (columnId: string) => {
      if (!onSortChange) return;

      const existingSort = sorts.find((s) => s.columnId === columnId);

      if (!existingSort) {
        onSortChange([{ columnId, direction: 'asc' }]);
      } else if (existingSort.direction === 'asc') {
        onSortChange([{ columnId, direction: 'desc' }]);
      } else {
        onSortChange([]);
      }
    },
    [sorts, onSortChange]
  );

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedRows.size === rows.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((r) => r.id)));
    }
  }, [rows, selectedRows, onSelectionChange]);

  const handleSelectRow = useCallback(
    (rowId: string) => {
      if (!onSelectionChange) return;

      const newSelection = new Set(selectedRows);
      if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }
      onSelectionChange(newSelection);
    },
    [selectedRows, onSelectionChange]
  );

  const getSortDirection = useCallback(
    (columnId: string): 'asc' | 'desc' | null => {
      const sort = sorts.find((s) => s.columnId === columnId);
      return sort?.direction ?? null;
    },
    [sorts]
  );

  const handleAddProperty = useCallback(() => {
    if (newPropertyName.trim() && onAddProperty) {
      onAddProperty(newPropertyName.trim(), newPropertyType);
      setNewPropertyName('');
      setNewPropertyType('text');
      setShowNewProperty(false);
    }
  }, [newPropertyName, newPropertyType, onAddProperty]);

  // Each group's rows laid out with their children, and the number its header shows.
  const groupLayouts = useMemo(
    () =>
      groups.map((group) => ({
        group,
        flatRows: flattenRowTree(group.rows, rowChildrenMap, localCollapsedParents),
        rowCount: flattenRowTree(group.rows, rowChildrenMap).filter((f) => !isCountedRow || isCountedRow(f.row)).length,
      })),
    [groups, rowChildrenMap, localCollapsedParents, isCountedRow]
  );

  const footerRows = useMemo(() => (isCountedRow ? rows.filter(isCountedRow) : rows), [rows, isCountedRow]);

  // Compute the visible data rows (flat list for keyboard nav)
  const visibleDataRows = useMemo(() => {
    if (isGrouped) {
      const result: Row[] = [];
      for (const layout of groupLayouts) {
        if (!layout.group.isCollapsed) {
          result.push(...layout.flatRows.map((f) => f.row));
        }
      }
      return result;
    }
    return flattenedRows.map((f) => f.row);
  }, [isGrouped, groupLayouts, flattenedRows]);

  // Keyboard navigation handler
  const handleKeyboardNav = useCallback(
    (e: React.KeyboardEvent) => {
      // Skip if typing in an input/textarea/contentEditable
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      // Any focused input inside the grid means the user is editing, whether it
      // was entered via Enter (isEditingCell) or a direct click on the cell.
      if (isInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsEditingCell(false);
          tableContainerRef.current?.focus();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          // Blur commits the current edit, then move
          (e.target as HTMLElement).blur();
          setIsEditingCell(false);
          setActiveCell((prev) => {
            if (!prev) return prev;
            const maxC = orderedColumns.length - 1;
            const maxR = visibleDataRows.length - 1;
            if (e.shiftKey) {
              if (prev.colIndex > 0) return { ...prev, colIndex: prev.colIndex - 1 };
              if (prev.rowIndex > 0) return { rowIndex: prev.rowIndex - 1, colIndex: maxC };
              return prev;
            } else {
              if (prev.colIndex < maxC) return { ...prev, colIndex: prev.colIndex + 1 };
              if (prev.rowIndex < maxR) return { rowIndex: prev.rowIndex + 1, colIndex: 0 };
              return prev;
            }
          });
          tableContainerRef.current?.focus();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          // Commit and move down
          (e.target as HTMLElement).blur();
          setIsEditingCell(false);
          setActiveCell((prev) => {
            if (!prev) return prev;
            const maxR = visibleDataRows.length - 1;
            return { ...prev, rowIndex: Math.min(maxR, prev.rowIndex + 1) };
          });
          tableContainerRef.current?.focus();
          return;
        }
        // Arrow keys while editing: commit and navigate
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
          setIsEditingCell(false);
          setActiveCell((prev) => {
            if (!prev) return prev;
            const maxR = visibleDataRows.length - 1;
            const newRow = e.key === 'ArrowUp' ? Math.max(0, prev.rowIndex - 1) : Math.min(maxR, prev.rowIndex + 1);
            return { ...prev, rowIndex: newRow };
          });
          tableContainerRef.current?.focus();
          return;
        }
        return; // Let other keys pass through to the input
      }

      const maxRow = visibleDataRows.length - 1;
      const maxCol = orderedColumns.length - 1;

      // Shift+Arrow up/down: extend a contiguous row selection from the focused
      // row (Notion-style). The anchor is the row focused when the first
      // Shift+Arrow was pressed; the selection is always anchor..focus.
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && onSelectionChange && maxRow >= 0) {
        e.preventDefault();
        const current = activeCell?.rowIndex ?? 0;
        if (selectionAnchorRef.current === null) selectionAnchorRef.current = current;
        const next = e.key === 'ArrowUp' ? Math.max(0, current - 1) : Math.min(maxRow, current + 1);
        setActiveCell((prev) => (prev ? { ...prev, rowIndex: next } : { rowIndex: next, colIndex: 0 }));
        const anchor = selectionAnchorRef.current;
        const [lo, hi] = anchor <= next ? [anchor, next] : [next, anchor];
        onSelectionChange(new Set(visibleDataRows.slice(lo, hi + 1).map((r) => r.id)));
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          selectionAnchorRef.current = null;
          setActiveCell((prev) =>
            prev ? { ...prev, rowIndex: Math.max(0, prev.rowIndex - 1) } : { rowIndex: 0, colIndex: 0 }
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
          selectionAnchorRef.current = null;
          setActiveCell((prev) =>
            prev ? { ...prev, rowIndex: Math.min(maxRow, prev.rowIndex + 1) } : { rowIndex: 0, colIndex: 0 }
          );
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setActiveCell((prev) =>
            prev ? { ...prev, colIndex: Math.max(0, prev.colIndex - 1) } : { rowIndex: 0, colIndex: 0 }
          );
          break;
        case 'ArrowRight':
          e.preventDefault();
          setActiveCell((prev) =>
            prev ? { ...prev, colIndex: Math.min(maxCol, prev.colIndex + 1) } : { rowIndex: 0, colIndex: 0 }
          );
          break;
        case 'Tab':
          e.preventDefault();
          setActiveCell((prev) => {
            if (!prev) return { rowIndex: 0, colIndex: 0 };
            if (e.shiftKey) {
              if (prev.colIndex > 0) return { ...prev, colIndex: prev.colIndex - 1 };
              if (prev.rowIndex > 0) return { rowIndex: prev.rowIndex - 1, colIndex: maxCol };
              return prev;
            } else {
              if (prev.colIndex < maxCol) return { ...prev, colIndex: prev.colIndex + 1 };
              if (prev.rowIndex < maxRow) return { rowIndex: prev.rowIndex + 1, colIndex: 0 };
              return prev;
            }
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (activeCell && !readOnly) {
            setIsEditingCell(true);
            // Simulate a click on the cell content to trigger its internal editing mode
            requestAnimationFrame(() => {
              const cell = tableContainerRef.current?.querySelector('[data-cell-active="true"]');
              if (!cell) return;
              // First try clicking the display element (e.g. .dt-cell-text div)
              const clickable = cell.querySelector('.dt-cell-text, .dt-cell-number, .dt-cell-date, .dt-cell-url, .dt-cell-select, .dt-cell-boolean input') as HTMLElement | null;
              if (clickable) {
                clickable.click();
              }
              // Then focus any input that appeared after the click
              requestAnimationFrame(() => {
                const input = cell.querySelector('input, textarea, [contenteditable]') as HTMLElement | null;
                input?.focus();
              });
            });
          }
          break;
        case 'Escape':
          e.preventDefault();
          selectionAnchorRef.current = null;
          setActiveCell(null);
          setIsEditingCell(false);
          break;
        default:
          break;
      }
    },
    [activeCell, isEditingCell, visibleDataRows, orderedColumns.length, readOnly, onSelectionChange]
  );

  // Pre-select first cell when rows become available (only if keyboard nav enabled)
  useEffect(() => {
    if (enableKeyboardNav && !activeCellInitialized.current && visibleDataRows.length > 0 && orderedColumns.length > 0) {
      activeCellInitialized.current = true;
      setActiveCell({ rowIndex: 0, colIndex: 0 });
    }
  }, [enableKeyboardNav, visibleDataRows.length, orderedColumns.length]);

  // When active cell changes: blur any focused input (commits edits) and scroll into view
  useEffect(() => {
    if (activeCell) {
      // Blur any focused input OUTSIDE the newly active cell to commit edits
      // from the previous cell. Inputs inside the active cell are left alone:
      // a single click on a text cell both activates it AND opens its editor,
      // and blurring here killed that editor, forcing a second click to edit.
      requestAnimationFrame(() => {
        const focused = document.activeElement as HTMLElement | null;
        const activeCellEl = tableContainerRef.current?.querySelector('[data-cell-active="true"]');
        if (
          focused &&
          tableContainerRef.current?.contains(focused) &&
          focused !== tableContainerRef.current &&
          !(activeCellEl && activeCellEl.contains(focused))
        ) {
          focused.blur();
        }
        // Scroll active cell into view
        activeCellEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }, [activeCell]);

  const handleCellClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      selectionAnchorRef.current = null;
      setActiveCell({ rowIndex, colIndex });
      setIsEditingCell(false);
    },
    []
  );

  // Surface the focused row to the consumer (implicit single-row selection).
  useEffect(() => {
    if (!onActiveRowChange) return;
    const rowId =
      activeCell !== null && activeCell.rowIndex >= 0 && activeCell.rowIndex < visibleDataRows.length
        ? visibleDataRows[activeCell.rowIndex].id
        : null;
    onActiveRowChange(rowId);
  }, [activeCell, visibleDataRows, onActiveRowChange]);

  const totalColumns = columns.length + (onSelectionChange ? 1 : 0) + (onDeleteRow ? 1 : 0) + (onAddProperty ? 1 : 0);

  // Helper function to render a single data row
  // One header cell with sorting, the alignment menu, reordering and the resize handle.
  // Used by the plain table and by every group's table, so grouping loses none of them.
  const renderHeaderCell = (column: Column, colIndex: number) => {
    const sortDir = getSortDirection(column.id);
    const width = getColumnWidth(column.id);
    const isDraggingThis = isItemDragging(column.id);
    const isDropTargetThis = isDropTarget(column.id);
    const dropPosition = getDropPosition(column.id);
    const dragProps = getDragProps(column.id);
    const canDrag = !!onColumnReorder && !resizingColumn;
    const isLastColumn = colIndex === orderedColumns.length - 1;
    const cellBorderStyles = getCellBorderStyles(isLastColumn);
    const alignment = column.alignment ?? getDefaultAlignment(column.type);

    // Build className for drag states
    const headerClasses = [
      'dt-column-header',
      isDraggingThis ? 'dt-dragging' : '',
      isDropTargetThis && dropPosition === 'before' ? 'dt-drag-over-before' : '',
      isDropTargetThis && dropPosition === 'after' ? 'dt-drag-over-after' : '',
    ].filter(Boolean).join(' ');

    return (
      <th
        key={column.id}
        className={headerClasses}
        style={{
          width,
          minWidth: width,
          maxWidth: width,
          padding: '10px 12px',
          ...cellBorderStyles,
          textAlign: alignment,
          fontWeight: 500,
          color: 'var(--dt-text-primary)',
          cursor: isDragging ? 'grabbing' : (onSortChange ? 'pointer' : 'default'),
          userSelect: 'none',
          position: 'relative',
        }}
        onClick={() => !isDragging && handleSort(column.id)}
        onContextMenu={(e) => {
          if (onColumnAlignmentChange) {
            e.preventDefault();
            setHeaderMenu({
              columnId: column.id,
              position: { x: e.clientX, y: e.clientY },
            });
          }
        }}
        onMouseEnter={() => setHoveredColumnId(column.id)}
        onMouseLeave={() => setHoveredColumnId(null)}
        {...(canDrag ? {
          draggable: dragProps.draggable,
          onDragStart: dragProps.onDragStart,
          onDragOver: dragProps.onDragOver,
          onDragEnd: dragProps.onDragEnd,
          onDrop: dragProps.onDrop,
          onDragLeave: dragProps.onDragLeave,
        } : {})}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Drag handle */}
          {canDrag && (
            <span
              className="dt-drag-handle"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
                style={{ display: 'block' }}
              >
                <circle cx="3" cy="2" r="1" />
                <circle cx="7" cy="2" r="1" />
                <circle cx="3" cy="6" r="1" />
                <circle cx="7" cy="6" r="1" />
                <circle cx="3" cy="10" r="1" />
                <circle cx="7" cy="10" r="1" />
              </svg>
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {column.name}
          </span>
          {sortDir && (
            <span style={{ color: 'var(--dt-accent-primary)', fontSize: '12px', flexShrink: 0 }}>
              {sortDir === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        {/* Resize handle: a 9px strip on the column's right edge, drawn as a 3px line */}
        <div
          className={`dt-resize-handle${resizingColumn === column.id ? ' dt-resizing' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize column ${column.name}`}
          aria-valuenow={Math.round(width)}
          aria-valuemin={MIN_COLUMN_WIDTH}
          // Focusable by click, not a tab stop: a grouped table repeats the header in every group.
          tabIndex={-1}
          draggable={false}
          onMouseDown={(e) => handleResizeStart(e, column.id)}
          onKeyDown={(e) => handleResizeKey(e, column.id)}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
        />
      </th>
    );
  };

  const renderDataRow = (row: Row, depth: number, hasChildren: boolean, rowIndex?: number, groupKey?: string) => {
    const isExpanded = !localCollapsedParents.has(row.id);
    const indentPx = depth * 24; // 24px per nesting level
    const rowChildren = rowChildrenMap.get(row.id) ?? [];
    // The keyboard-focused row gets a subtle highlight (checkbox selection wins).
    const isRowActive =
      enableKeyboardNav && activeCell !== null && rowIndex !== undefined && activeCell.rowIndex === rowIndex;

    const canDrag = rowCanBeDragged(row, depth, groupKey);

    return (
      <tr
        key={row.id}
        data-row-id={row.id}
        data-row-active={isRowActive || undefined}
        data-row-depth={subItemsEnabled ? depth : undefined}
        data-row-selected={selectedRows.has(row.id) || undefined}
        className={
          [
            rowDrag?.rowIds.includes(row.id) || rowDrag?.followIds.includes(row.id) || rowDrag?.movableIds.includes(row.id) ? 'dt-row-dragging' : '',
            dragOverRow === row.id ? 'dt-row-drop-target' : '',
            dragOverRow !== null && dragOverRow === row.parentRowId ? 'dt-row-drop-target-child' : '',
          ].filter(Boolean).join(' ') || undefined
        }
        draggable={(canDrag && armedRowId === row.id) || undefined}
        onDragStart={canDrag ? (e) => handleRowDragStart(e, row, groupKey ?? UNGROUPED) : undefined}
        onDragEnd={canDrag ? endRowDrag : undefined}
        onDragOver={canMoveRows ? (e) => handleRowDragOver(e, row) : undefined}
        onDrop={canMoveRows ? (e) => handleRowDrop(e, row) : undefined}
        style={{
          backgroundColor: selectedRows.has(row.id)
            ? 'var(--dt-bg-selected)'
            : isRowActive
              ? 'var(--dt-bg-row-active, var(--dt-bg-secondary))'
              : 'var(--dt-bg-primary)',
        }}
      >
        {onSelectionChange && (
          <td className={selectColumnClass} style={getCellBorderStyles(false)}>
            {renderSelectControl(
              renderRowGrip(row.id, canDrag),
              <input
                type="checkbox"
                checked={selectedRows.has(row.id)}
                onChange={() => handleSelectRow(row.id)}
                style={{ cursor: 'pointer' }}
              />,
            )}
          </td>
        )}
        {orderedColumns.map((column, colIndex) => {
          const width = getColumnWidth(column.id);
          const isFirstColumn = colIndex === 0;
          const isLastColumn = colIndex === orderedColumns.length - 1;
          const cellBorderStyles = getCellBorderStyles(isLastColumn);
          const alignment = column.alignment ?? getDefaultAlignment(column.type);
          const isCellActive = enableKeyboardNav && activeCell !== null && rowIndex !== undefined && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex;
          const summary = subItemsEnabled ? getSubItemSummary?.(row, rowChildren, column) : undefined;
          const summaryNote = summary !== undefined && summary !== null ? getSubItemSummaryNote?.(row, rowChildren, column) : undefined;

          return (
            <td
              key={column.id}
              data-cell-active={isCellActive || undefined}
              onClick={enableKeyboardNav ? () => rowIndex !== undefined && handleCellClick(rowIndex, colIndex) : undefined}
              className={isCellActive ? 'dt-cell-active' : undefined}
              style={{
                width,
                minWidth: width,
                maxWidth: width,
                ...cellBorderStyles,
                textAlign: alignment,
                verticalAlign: 'middle',
                overflow: column.type === 'select' || column.type === 'multi_select' || column.type === 'file' || column.type === 'relation' ? 'visible' : 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: isFirstColumn && subItemsEnabled ? indentPx : 0,
                }}
              >
                {isFirstColumn && !onSelectionChange && renderRowGrip(row.id, canDrag)}
                {/* Expand/collapse toggle for first column when sub-items enabled */}
                {isFirstColumn && subItemsEnabled && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '4px',
                      minWidth: '20px',
                    }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(row.id);
                        }}
                        style={{
                          padding: '2px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--dt-text-secondary)',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                        title={isExpanded ? 'Collapse' : 'Expand'}
                        aria-label={isExpanded ? 'Collapse sub-items' : 'Expand sub-items'}
                        aria-expanded={isExpanded}
                      >
                        <span
                          style={{
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            display: 'inline-block',
                            transition: 'transform 0.15s ease-out',
                          }}
                        >
                          &#9654;
                        </span>
                      </button>
                    ) : onCreateSubItem ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateSubItem(row.id);
                        }}
                        className="dt-add-subitem-btn"
                        style={{
                          padding: '2px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--dt-border-color-strong)',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          opacity: 0,
                          transition: 'opacity 0.15s, background-color 0.15s',
                        }}
                        title="Add sub-item"
                      >
                        +
                      </button>
                    ) : (
                      <span style={{ width: '20px' }} />
                    )}
                  </div>
                )}

                {/* Cell content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CellRenderer
                    column={column}
                    value={summary !== undefined ? summary : row.cells[column.id]}
                    onChange={(value) => handleCellChange(row.id, column.id, value)}
                    selectOptions={selectOptions.get(column.id)}
                    readOnly={readOnly || summary !== undefined}
                    alignment={alignment}
                    onCreateOption={
                      onCreateSelectOption
                        ? (name, color) => onCreateSelectOption(column.id, name, color)
                        : undefined
                    }
                    onUpdateOption={onUpdateSelectOption}
                    onDeleteOption={
                      onDeleteSelectOption
                        ? (optionId) => onDeleteSelectOption(column.id, optionId)
                        : undefined
                    }
                    onUploadFile={
                      onUploadFile
                        ? (file) => onUploadFile(row.id, column.id, file)
                        : undefined
                    }
                    onDeleteFile={
                      onDeleteFile
                        ? (fileId) => onDeleteFile(row.id, column.id, fileId)
                        : undefined
                    }
                    onSearchRelationRows={onSearchRelationRows}
                    onGetRelationRowTitle={onGetRelationRowTitle}
                  />
                </div>
                {summaryNote && (
                  <span className="dt-summary-note" style={{ marginLeft: '6px', flexShrink: 0, fontSize: '12px', color: 'var(--dt-text-muted)', whiteSpace: 'nowrap' }}>
                    {summaryNote}
                  </span>
                )}
                {/* OPEN button on primary column */}
                {isFirstColumn && onRowOpen && (
                  <button
                    className="dt-row-open-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowOpen(row);
                    }}
                    style={{
                      marginLeft: '4px',
                      padding: '1px 6px',
                      border: '1px solid var(--dt-border-color)',
                      borderRadius: '4px',
                      background: 'var(--dt-bg-secondary)',
                      color: 'var(--dt-text-muted)',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase' as const,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap' as const,
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    OPEN
                  </button>
                )}
              </div>
            </td>
          );
        })}
        {/* Empty cell for add property column */}
        {onAddProperty && (
          <td
            style={{
              ...getCellBorderStyles(false),
            }}
          />
        )}
        {onDeleteRow && (
          <td
            style={{
              padding: '4px 8px',
              ...getCellBorderStyles(true),
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => onDeleteRow(row.id)}
              style={{
                padding: '4px 8px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--dt-text-muted)',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dt-accent-danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dt-text-muted)')}
            >
              x
            </button>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div
      ref={tableContainerRef}
      className={`dt-table-view ${className ?? ''}`}
      tabIndex={enableKeyboardNav ? 0 : undefined}
      onKeyDown={enableKeyboardNav ? handleKeyboardNav : undefined}
      onClick={enableKeyboardNav ? (e: React.MouseEvent) => {
        // Re-focus the container when clicking inside the table so keyboard nav keeps working
        // Skip if clicking on an input/textarea/button (they need their own focus)
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON' && tag !== 'SELECT' && !(e.target as HTMLElement).isContentEditable) {
          tableContainerRef.current?.focus();
        }
      } : undefined}
      style={{
        border: isGrouped ? 'none' : (borderConfig?.showOuterBorder ?? true)
          ? `1px solid ${borderConfig?.borderColor ?? 'var(--dt-border-color-strong)'}`
          : 'none',
        borderRadius: isGrouped ? '0' : '8px',
        position: 'relative',
        backgroundColor: isGrouped ? 'transparent' : 'var(--dt-bg-primary)',
        overflow: isGrouped ? 'visible' : 'hidden',
        outline: 'none',
        ...style,
      }}
    >
      {/* Hide scrollbar CSS and drag/drop styles */}
      <style>{`
        .dt-table-scroll-container {
          overflow-x: scroll;
          overflow-y: visible;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .dt-table-scroll-container::-webkit-scrollbar {
          display: none; /* Chrome/Safari/Opera */
        }
        .dt-column-header {
          position: relative;
        }
        .dt-column-header.dt-dragging {
          opacity: 0.5;
        }
        .dt-column-header.dt-drag-over-before::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 0;
          bottom: 0;
          width: 2px;
          background-color: var(--dt-accent-primary);
          z-index: 10;
        }
        .dt-column-header.dt-drag-over-after::after {
          content: '';
          position: absolute;
          right: -1px;
          top: 0;
          bottom: 0;
          width: 2px;
          background-color: var(--dt-accent-primary);
          z-index: 10;
        }
        .dt-resize-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          width: 9px;
          cursor: col-resize;
          z-index: 2;
          touch-action: none;
        }
        .dt-resize-handle::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          width: 3px;
          background-color: transparent;
          transition: background-color 0.12s ease-out;
        }
        .dt-resize-handle:hover::after,
        .dt-resize-handle:focus-visible::after {
          background-color: var(--dt-border-color-strong);
        }
        .dt-resize-handle.dt-resizing::after {
          background-color: var(--dt-accent-primary);
        }
        .dt-resize-handle:focus-visible {
          outline: none;
        }
        .dt-select-col {
          width: 40px;
          min-width: 40px;
          padding: 4px;
        }
        .dt-select-col-grips {
          width: 56px;
          min-width: 56px;
        }
        .dt-select-control {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .dt-row-grip-slot {
          flex: none;
          width: 20px;
          height: 24px;
        }
        .dt-row-grip {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: var(--dt-text-muted);
          cursor: grab;
          opacity: 0;
          transition: opacity 0.12s ease-out, background-color 0.12s ease-out, color 0.12s ease-out;
        }
        tr:hover .dt-row-grip,
        tr[data-row-selected] .dt-row-grip,
        tr.dt-row-dragging .dt-row-grip {
          opacity: 1;
        }
        .dt-row-grip:hover,
        tr.dt-row-dragging .dt-row-grip {
          background-color: var(--dt-border-color);
          color: var(--dt-text-primary);
        }
        .dt-row-grip:active {
          cursor: grabbing;
        }
        /* A row is dragged with a mouse, so a touch screen gives the space to the table. */
        @media (hover: none) {
          .dt-select-col-grips {
            width: 40px;
            min-width: 40px;
          }
          .dt-row-grip-slot {
            display: none;
          }
        }
        tr.dt-row-dragging {
          opacity: 0.45;
        }
        tr.dt-row-drop-target,
        tr.dt-row-drop-target-child {
          background-color: var(--dt-bg-hover) !important;
        }
        tr.dt-row-drop-target {
          outline: 2px solid var(--dt-accent-primary);
          outline-offset: -2px;
        }
        .dt-group-section {
          border-radius: var(--dt-border-radius-sm, 6px);
          outline: 2px solid transparent;
          outline-offset: 3px;
          transition: outline-color 0.12s ease-out, background-color 0.12s ease-out;
        }
        .dt-group-section.dt-group-drop-target {
          outline-color: var(--dt-accent-primary);
          background-color: var(--dt-bg-hover);
        }
        tbody.dt-group-drop-target {
          outline: 2px solid var(--dt-accent-primary);
          outline-offset: -2px;
        }
        .dt-drag-handle {
          opacity: 0;
          cursor: grab;
          color: var(--dt-text-muted);
          display: flex;
          align-items: center;
          padding: 2px;
          margin-right: 4px;
          border-radius: 2px;
          transition: opacity 0.15s ease-in-out;
          flex-shrink: 0;
        }
        .dt-drag-handle:hover {
          background-color: var(--dt-border-color);
          color: var(--dt-text-secondary);
        }
        .dt-drag-handle:active {
          cursor: grabbing;
        }
        .dt-column-header:hover .dt-drag-handle,
        .dt-column-header.dt-dragging .dt-drag-handle {
          opacity: 1;
        }
        /* Show add sub-item button on row hover */
        tr:hover .dt-add-subitem-btn {
          opacity: 1 !important;
        }
        tr:hover .dt-add-subitem-btn:hover {
          color: var(--dt-text-secondary) !important;
          background-color: var(--dt-bg-hover);
        }
        /* Active cell highlight */
        .dt-cell-active {
          background-color: rgba(255, 255, 255, 0.04) !important;
        }
        .dt-cell-active::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 2px solid var(--dt-accent-primary);
          border-radius: 2px;
          pointer-events: none;
          z-index: 1;
        }
        .dt-table-view:focus .dt-cell-active {
          background-color: rgba(37, 99, 235, 0.06) !important;
        }
      `}</style>
      <div className="dt-table-scroll-container">
        {/* Column header rendering helper - reused per group in grouped mode */}
        {isGrouped ? (
          // Grouped mode: each group is its own section with separate table
          (() => {
            let runningIndex = 0;
            return (
              <>
                {onGroupConfigChange && groupConfig && groups.length > 1 && (
                  <div className="dt-group-fold-all" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleFoldAllGroups(!allGroupsCollapsed)}
                      aria-expanded={!allGroupsCollapsed}
                      style={{
                        padding: '2px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--dt-text-secondary)',
                      }}
                    >
                      {allGroupsCollapsed ? 'Expand all' : 'Collapse all'}
                    </button>
                  </div>
                )}
                {groupLayouts.map(({ group, flatRows, rowCount }) => (
                  <div
                    key={group.value}
                    className={`dt-group-section${dragOverGroup === group.value ? ' dt-group-drop-target' : ''}`}
                    data-group-key={group.value}
                    style={{ marginBottom: '20px' }}
                    onDragOver={canDragRows || canMoveRows ? (e) => handleGroupDragOver(e, group.value) : undefined}
                    onDragLeave={canDragRows || canMoveRows ? (e) => handleGroupDragLeave(e, group.value) : undefined}
                    onDrop={canDragRows || canMoveRows ? (e) => handleGroupDrop(e, group.value) : undefined}
                  >
                    <GroupHeader
                      label={group.label}
                      rowCount={rowCount}
                      isCollapsed={group.isCollapsed}
                      onToggleCollapse={() => handleToggleGroupCollapse(group.value)}
                      colSpan={totalColumns}
                    />
                    {!group.isCollapsed && (
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '14px',
                          tableLayout: 'fixed',
                          borderRadius: 'var(--dt-border-radius-sm, 6px)',
                          overflow: 'hidden',
                          border: '1px solid var(--dt-border-color)',
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: 'var(--dt-bg-secondary)' }}>
                            {onSelectionChange && (
                              <th className={selectColumnClass} style={getCellBorderStyles(false)}>
                                {renderSelectControl(
                                  hasRowGrips ? <span className="dt-row-grip-slot" /> : null,
                                  <input type="checkbox" checked={false} onChange={handleSelectAll} style={{ cursor: 'pointer' }} />,
                                )}
                              </th>
                            )}
                            {orderedColumns.map(renderHeaderCell)}
                            {onAddProperty && <th style={{ width: '140px', minWidth: '140px', ...getCellBorderStyles(false) }} />}
                            {onDeleteRow && <th style={{ width: '50px', minWidth: '50px', padding: '10px 8px', ...getCellBorderStyles(true) }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {flatRows.map(({ row, depth, hasChildren }) => {
                            const idx = runningIndex++;
                            return renderDataRow(row, depth, hasChildren, idx, group.value);
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}

                {/* Empty state */}
                {!groups.some((g) => g.rows.length > 0) && !isLoading && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dt-text-muted)' }}>
                    No data yet
                  </div>
                )}

                {/* Loading state */}
                {isLoading && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--dt-text-muted)' }}>
                    Loading...
                  </div>
                )}
              </>
            );
          })()
        ) : (
        // Ungrouped mode: single table as before
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: 'var(--dt-bg-secondary)' }}>
              {onSelectionChange && (
                <th className={selectColumnClass} style={getCellBorderStyles(false)}>
                  {renderSelectControl(
                    hasRowGrips ? <span className="dt-row-grip-slot" /> : null,
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedRows.size === rows.length}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />,
                  )}
                </th>
              )}
              {orderedColumns.map(renderHeaderCell)}
              {/* Add Property column */}
              {onAddProperty && (
                <th
                  style={{
                    width: '140px',
                    minWidth: '140px',
                    padding: '10px 12px',
                    ...getCellBorderStyles(false),
                    textAlign: 'left',
                    fontWeight: 400,
                  }}
                >
                  {showNewProperty ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        type="text"
                        value={newPropertyName}
                        onChange={(e) => setNewPropertyName(e.target.value)}
                        placeholder="Property name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddProperty();
                          if (e.key === 'Escape') setShowNewProperty(false);
                        }}
                        style={{
                          padding: '4px 6px',
                          border: '1px solid var(--dt-border-color-strong)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%',
                          backgroundColor: 'var(--dt-bg-primary)',
                          color: 'var(--dt-text-primary)',
                        }}
                      />
                      <select
                        value={newPropertyType}
                        onChange={(e) => setNewPropertyType(e.target.value as ColumnType)}
                        style={{
                          padding: '4px 6px',
                          border: '1px solid var(--dt-border-color-strong)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%',
                          backgroundColor: 'var(--dt-bg-primary)',
                          color: 'var(--dt-text-primary)',
                        }}
                      >
                        {COLUMN_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={handleAddProperty}
                          style={{
                            flex: 1,
                            padding: '4px',
                            backgroundColor: 'var(--dt-accent-primary)',
                            color: 'var(--dt-bg-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowNewProperty(false)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'var(--dt-border-color)',
                            color: 'var(--dt-text-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewProperty(true)}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'var(--dt-text-muted)',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dt-text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dt-text-muted)')}
                    >
                      + New property
                    </button>
                  )}
                </th>
              )}
              {onDeleteRow && (
                <th
                  style={{
                    width: '50px',
                    minWidth: '50px',
                    padding: '10px 8px',
                    ...getCellBorderStyles(true),
                  }}
                />
              )}
            </tr>
          </thead>
          <tbody
            className={dragOverGroup === UNGROUPED ? 'dt-group-drop-target' : undefined}
            onDragOver={canMoveRows ? (e) => handleGroupDragOver(e, UNGROUPED) : undefined}
            onDragLeave={canMoveRows ? (e) => handleGroupDragLeave(e, UNGROUPED) : undefined}
            onDrop={canMoveRows ? (e) => handleGroupDrop(e, UNGROUPED) : undefined}
          >
            {/* Flat or hierarchical rendering (ungrouped only) */}
            {flattenedRows.map(({ row, depth, hasChildren }, idx) =>
              renderDataRow(row, depth, hasChildren, idx)
            )}

            {/* Empty state */}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={totalColumns}
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: 'var(--dt-text-muted)',
                  }}
                >
                  No data yet
                </td>
              </tr>
            )}

            {/* Loading state */}
            {isLoading && (
              <tr>
                <td
                  colSpan={totalColumns}
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: 'var(--dt-text-muted)',
                  }}
                >
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
          {/* Footer calculations */}
          {showFooter && !isGrouped && (
            <TableFooter
              columns={orderedColumns}
              rows={footerRows}
              footerConfig={footerConfig}
              onFooterConfigChange={onFooterConfigChange}
              columnWidths={columnWidths}
              showSelectionColumn={!!onSelectionChange}
              showDeleteColumn={!!onDeleteRow}
              showAddPropertyColumn={!!onAddProperty}
              borderConfig={borderConfig}
            />
          )}
        </table>
        )}
      </div>

      {/* Footer with Add Row and Load More */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderTop: '1px solid var(--dt-border-color)',
          backgroundColor: 'var(--dt-bg-secondary)',
        }}
      >
        {onAddRow ? (
          <button
            onClick={onAddRow}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--dt-border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--dt-bg-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--dt-text-primary)',
            }}
          >
            + New row
          </button>
        ) : (
          <div />
        )}

        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--dt-border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--dt-bg-primary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              color: 'var(--dt-text-primary)',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Load more
          </button>
        )}
      </div>

      {/* Column header alignment context menu */}
      {headerMenu && onColumnAlignmentChange && (
        <ColumnHeaderMenu
          columnId={headerMenu.columnId}
          currentAlignment={
            orderedColumns.find((c) => c.id === headerMenu.columnId)?.alignment
            ?? getDefaultAlignment(orderedColumns.find((c) => c.id === headerMenu.columnId)!.type)
          }
          position={headerMenu.position}
          onAlignmentChange={(alignment) => {
            onColumnAlignmentChange(headerMenu.columnId, alignment);
            setHeaderMenu(null);
          }}
          onClose={() => setHeaderMenu(null)}
        />
      )}
    </div>
  );
}
