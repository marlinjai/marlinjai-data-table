import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type { Column, Row, CellValue, SelectOption, QuerySort, ColumnType, FileReference, SubItemsConfig, GroupConfig, FooterConfig, BorderConfig, TextAlignment } from '@marlinjai/data-table-core';
import { CellRenderer } from './cells/CellRenderer';
import { GroupHeader } from './GroupHeader';
import { TableFooter } from './TableFooter';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';
import { useGrouping } from '../hooks/useGrouping';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

// Tree node for hierarchical row rendering
interface RowTreeNode {
  row: Row;
  depth: number;
  children: RowTreeNode[];
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

  // Loading states
  isLoading?: boolean;

  // Pagination
  hasMore?: boolean;
  onLoadMore?: () => void;

  // Sub-items / Hierarchical rows
  subItemsConfig?: SubItemsConfig;
  onExpandRow?: (rowId: string) => void;
  onCollapseRow?: (rowId: string) => void;
  onCreateSubItem?: (parentRowId: string) => void;

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
  isLoading,
  hasMore,
  onLoadMore,
  subItemsConfig,
  onExpandRow,
  onCollapseRow,
  onCreateSubItem,
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

  // Sync localCollapsedParents with subItemsConfig.collapsedParents when it changes
  useEffect(() => {
    if (subItemsConfig?.collapsedParents) {
      setLocalCollapsedParents(new Set(subItemsConfig.collapsedParents));
    }
  }, [subItemsConfig?.collapsedParents]);

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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

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

  // Build tree structure for hierarchical rows
  const { rowTree, rowChildrenMap, flattenedRows } = useMemo(() => {
    // If sub-items are not enabled, return flat structure
    if (!subItemsConfig?.enabled) {
      return {
        rowTree: rows.map((row) => ({ row, depth: 0, children: [] })),
        rowChildrenMap: new Map<string, Row[]>(),
        flattenedRows: rows.map((row) => ({ row, depth: 0, hasChildren: false })),
      };
    }

    // Build parent-children map
    const childrenMap = new Map<string, Row[]>();
    const topLevelRows: Row[] = [];

    for (const row of rows) {
      if (row.parentRowId) {
        const siblings = childrenMap.get(row.parentRowId) ?? [];
        siblings.push(row);
        childrenMap.set(row.parentRowId, siblings);
      } else {
        topLevelRows.push(row);
      }
    }

    // Build tree recursively
    const buildNode = (row: Row, depth: number): RowTreeNode => {
      const children = childrenMap.get(row.id) ?? [];
      return {
        row,
        depth,
        children: children.map((child) => buildNode(child, depth + 1)),
      };
    };

    const tree = topLevelRows.map((row) => buildNode(row, 0));

    // Flatten tree for rendering, respecting collapsed state
    const flattened: Array<{ row: Row; depth: number; hasChildren: boolean }> = [];

    const flattenNode = (node: RowTreeNode) => {
      const hasChildren = node.children.length > 0;
      flattened.push({ row: node.row, depth: node.depth, hasChildren });

      const isCollapsed = localCollapsedParents.has(node.row.id);
      if (!isCollapsed && hasChildren) {
        for (const child of node.children) {
          flattenNode(child);
        }
      }
    };

    for (const node of tree) {
      flattenNode(node);
    }

    return {
      rowTree: tree,
      rowChildrenMap: childrenMap,
      flattenedRows: flattened,
    };
  }, [rows, subItemsConfig?.enabled, localCollapsedParents]);

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
  const { groups, isGrouped } = useGrouping({
    rows,
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
    },
    [columnWidths]
  );

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(80, resizeStartWidth.current + diff);
      setColumnWidths((prev) => new Map(prev).set(resizingColumn, newWidth));
    };

    const handleMouseUp = () => {
      if (resizingColumn && onColumnResize) {
        onColumnResize(resizingColumn, getColumnWidth(resizingColumn));
      }
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
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

  // Compute the visible data rows (flat list for keyboard nav)
  const visibleDataRows = useMemo(() => {
    if (isGrouped) {
      const result: Row[] = [];
      for (const group of groups) {
        if (!group.isCollapsed) {
          result.push(...group.rows);
        }
      }
      return result;
    }
    return flattenedRows.map((f) => f.row);
  }, [isGrouped, groups, flattenedRows]);

  // Keyboard navigation handler
  const handleKeyboardNav = useCallback(
    (e: React.KeyboardEvent) => {
      // Skip if typing in an input/textarea/contentEditable
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      if (isEditingCell && isInput) {
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

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setActiveCell((prev) =>
            prev ? { ...prev, rowIndex: Math.max(0, prev.rowIndex - 1) } : { rowIndex: 0, colIndex: 0 }
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
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
          setActiveCell(null);
          setIsEditingCell(false);
          break;
        default:
          break;
      }
    },
    [activeCell, isEditingCell, visibleDataRows.length, orderedColumns.length, readOnly]
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
      // Blur any currently focused input to commit edits from the previous cell
      const focused = document.activeElement as HTMLElement | null;
      if (focused && tableContainerRef.current?.contains(focused) && focused !== tableContainerRef.current) {
        focused.blur();
      }
      setIsEditingCell(false);
      // Scroll active cell into view
      requestAnimationFrame(() => {
        const cell = tableContainerRef.current?.querySelector('[data-cell-active="true"]');
        cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }, [activeCell]);

  const handleCellClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      setActiveCell({ rowIndex, colIndex });
      setIsEditingCell(false);
    },
    []
  );

  const totalColumns = columns.length + (onSelectionChange ? 1 : 0) + (onDeleteRow ? 1 : 0) + (onAddProperty ? 1 : 0);

  // Helper function to render a single data row
  const renderDataRow = (row: Row, depth: number, hasChildren: boolean, rowIndex?: number) => {
    const isExpanded = !localCollapsedParents.has(row.id);
    const indentPx = depth * 24; // 24px per nesting level

    return (
      <tr
        key={row.id}
        data-row-id={row.id}
        style={{
          backgroundColor: selectedRows.has(row.id) ? 'var(--dt-bg-selected)' : 'var(--dt-bg-primary)',
        }}
      >
        {onSelectionChange && (
          <td
            style={{
              padding: '4px 8px',
              ...getCellBorderStyles(false),
              textAlign: 'center',
            }}
          >
            <input
              type="checkbox"
              checked={selectedRows.has(row.id)}
              onChange={() => handleSelectRow(row.id)}
              style={{ cursor: 'pointer' }}
            />
          </td>
        )}
        {orderedColumns.map((column, colIndex) => {
          const width = getColumnWidth(column.id);
          const isFirstColumn = colIndex === 0;
          const isLastColumn = colIndex === orderedColumns.length - 1;
          const cellBorderStyles = getCellBorderStyles(isLastColumn);
          const alignment = column.alignment ?? getDefaultAlignment(column.type);
          const isCellActive = enableKeyboardNav && activeCell !== null && rowIndex !== undefined && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex;

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
                  paddingLeft: isFirstColumn && subItemsConfig?.enabled ? indentPx : 0,
                }}
              >
                {/* Expand/collapse toggle for first column when sub-items enabled */}
                {isFirstColumn && subItemsConfig?.enabled && (
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
                      >
                        <span
                          style={{
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            display: 'inline-block',
                            transition: 'transform 0.15s',
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
                    value={row.cells[column.id]}
                    onChange={(value) => handleCellChange(row.id, column.id, value)}
                    selectOptions={selectOptions.get(column.id)}
                    readOnly={readOnly}
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
                {groups.map((group) => (
                  <div key={group.value} className="dt-group-section" style={{ marginBottom: '20px' }}>
                    <GroupHeader
                      label={group.label}
                      rowCount={group.rows.length}
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
                              <th style={{ width: '40px', minWidth: '40px', padding: '10px 8px', ...getCellBorderStyles(false), textAlign: 'center' }}>
                                <input type="checkbox" checked={false} onChange={handleSelectAll} style={{ cursor: 'pointer' }} />
                              </th>
                            )}
                            {orderedColumns.map((column, colIndex) => {
                              const width = getColumnWidth(column.id);
                              const isLastColumn = colIndex === orderedColumns.length - 1;
                              const alignment = column.alignment ?? getDefaultAlignment(column.type);
                              return (
                                <th key={column.id} style={{ width: `${width}px`, minWidth: `${width}px`, padding: '8px 12px', ...getCellBorderStyles(isLastColumn), textAlign: alignment, fontWeight: 500, color: 'var(--dt-text-secondary)', fontSize: 'var(--dt-font-size-sm, 12px)' }}>
                                  {column.name}
                                </th>
                              );
                            })}
                            {onDeleteRow && <th style={{ width: '50px', minWidth: '50px', padding: '10px 8px', ...getCellBorderStyles(true) }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => {
                            const idx = runningIndex++;
                            return renderDataRow(row, 0, false, idx);
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
                <th
                  style={{
                    width: '40px',
                    minWidth: '40px',
                    padding: '10px 8px',
                    ...getCellBorderStyles(false),
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRows.size === rows.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {orderedColumns.map((column, colIndex) => {
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
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, column.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        backgroundColor: resizingColumn === column.id ? 'var(--dt-accent-primary)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!resizingColumn) e.currentTarget.style.backgroundColor = 'var(--dt-border-color-strong)';
                      }}
                      onMouseLeave={(e) => {
                        if (!resizingColumn) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    />
                  </th>
                );
              })}
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
          <tbody>
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
              rows={rows}
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
