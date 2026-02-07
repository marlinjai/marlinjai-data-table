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

  const totalColumns = columns.length + (onSelectionChange ? 1 : 0) + (onDeleteRow ? 1 : 0) + (onAddProperty ? 1 : 0);

  // Helper function to render a single data row
  const renderDataRow = (row: Row, depth: number, hasChildren: boolean) => {
    const isExpanded = !localCollapsedParents.has(row.id);
    const indentPx = depth * 24; // 24px per nesting level

    return (
      <tr
        key={row.id}
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

          return (
            <td
              key={column.id}
              style={{
                width,
                minWidth: width,
                maxWidth: width,
                ...cellBorderStyles,
                textAlign: alignment,
                verticalAlign: 'middle',
                overflow: column.type === 'select' || column.type === 'multi_select' || column.type === 'file' || column.type === 'relation' ? 'visible' : 'hidden',
                position: column.type === 'select' || column.type === 'multi_select' || column.type === 'file' || column.type === 'relation' ? 'relative' : undefined,
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
      className={`dt-table-view ${className ?? ''}`}
      style={{
        border: (borderConfig?.showOuterBorder ?? true)
          ? `1px solid ${borderConfig?.borderColor ?? 'var(--dt-border-color-strong)'}`
          : 'none',
        borderRadius: '8px',
        position: 'relative',
        backgroundColor: 'var(--dt-bg-primary)',
        overflow: 'hidden',
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
      `}</style>
      <div className="dt-table-scroll-container">
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
            {/* Render rows - either grouped or flat/hierarchical */}
            {isGrouped ? (
              // Grouped rendering
              groups.map((group) => (
                <React.Fragment key={group.value}>
                  <GroupHeader
                    label={group.label}
                    rowCount={group.rows.length}
                    isCollapsed={group.isCollapsed}
                    onToggleCollapse={() => handleToggleGroupCollapse(group.value)}
                    colSpan={totalColumns}
                  />
                  {!group.isCollapsed && group.rows.map((row) => renderDataRow(row, 0, false))}
                </React.Fragment>
              ))
            ) : (
              // Flat or hierarchical rendering
              flattenedRows.map(({ row, depth, hasChildren }) =>
                renderDataRow(row, depth, hasChildren)
              )
            )}

            {/* Empty state */}
            {(isGrouped ? !groups.some((g) => g.rows.length > 0) : rows.length === 0) && !isLoading && (
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
