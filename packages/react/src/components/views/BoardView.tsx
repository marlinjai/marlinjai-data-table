import { useCallback, useMemo, useState, useRef } from 'react';
import type {
  Row,
  Column,
  CellValue,
  SelectOption,
  BoardViewConfig,
  FileReference,
} from '@marlinjai/data-table-core';
import { BoardColumn } from './BoardColumn';
import { RowDetailPanel } from './RowDetailPanel';
import type { BoardColumnSortOrder } from './BoardColumnMenu';

export interface BoardViewProps {
  columns: Column[];
  rows: Row[];
  selectOptions?: Map<string, SelectOption[]>;

  // Board configuration
  config: BoardViewConfig;
  onConfigChange?: (config: BoardViewConfig) => void;

  // Cell editing (for drag-and-drop updates)
  onCellChange?: (rowId: string, columnId: string, value: CellValue) => void;
  readOnly?: boolean;

  // Row actions
  onAddRow?: (initialCellValues?: Record<string, CellValue>) => void;
  onDeleteRow?: (rowId: string) => void;

  // Card click - if not provided, built-in detail panel will be used
  onCardClick?: (rowId: string) => void;
  useBuiltInDetailPanel?: boolean;

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

  // Loading states
  isLoading?: boolean;

  // Styling
  className?: string;
  style?: React.CSSProperties;
}

interface GroupedRows {
  groupValue: string | null;
  option?: SelectOption;
  rows: Row[];
}

export function BoardView({
  columns,
  rows,
  selectOptions = new Map(),
  config,
  onConfigChange,
  onCellChange,
  readOnly = false,
  onAddRow,
  onDeleteRow,
  onCardClick,
  useBuiltInDetailPanel = true,
  onCreateSelectOption,
  onUpdateSelectOption,
  onDeleteSelectOption,
  onUploadFile,
  onDeleteFile,
  onSearchRelationRows,
  onGetRelationRowTitle,
  isLoading,
  className,
  style,
}: BoardViewProps) {
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const addColumnInputRef = useRef<HTMLInputElement>(null);

  // Get the grouping column
  const groupByColumn = useMemo(
    () => columns.find((col) => col.id === config.groupByColumnId),
    [columns, config.groupByColumnId]
  );

  // Get options for the grouping column
  const groupOptions = useMemo(
    () => selectOptions.get(config.groupByColumnId) ?? [],
    [selectOptions, config.groupByColumnId]
  );

  // Sort rows within a group based on config
  const sortRowsInGroup = useCallback(
    (groupRows: Row[], groupValue: string | null): Row[] => {
      const groupKey = groupValue ?? '__no_status__';
      const sortOrder = config.groupSortOrder?.[groupKey] ?? 'manual';
      const cardOrder = config.cardOrder?.[groupKey];

      if (sortOrder === 'manual' && cardOrder) {
        // Sort by card order
        const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
        return [...groupRows].sort((a, b) => {
          const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });
      } else if (sortOrder === 'alphabetical') {
        const primaryColumn = columns.find((col) => col.isPrimary);
        if (primaryColumn) {
          return [...groupRows].sort((a, b) => {
            const aVal = String(a.cells[primaryColumn.id] ?? '');
            const bVal = String(b.cells[primaryColumn.id] ?? '');
            return aVal.localeCompare(bVal);
          });
        }
      } else if (sortOrder === 'date') {
        return [...groupRows].sort((a, b) => {
          const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return bDate.getTime() - aDate.getTime(); // Newest first
        });
      }

      return groupRows;
    },
    [config.groupSortOrder, config.cardOrder, columns]
  );

  // Group rows by the select column value
  const groupedRows = useMemo((): GroupedRows[] => {
    if (!groupByColumn) {
      // If no valid group column, show all rows in one column
      return [{ groupValue: null, rows }];
    }

    const groups = new Map<string | null, Row[]>();

    // Initialize groups for all options if showEmptyGroups is true
    if (config.showEmptyGroups) {
      groupOptions.forEach((option) => {
        groups.set(option.id, []);
      });
    }

    // Always have a "No Status" group for items without a value
    groups.set(null, []);

    // Group the rows
    rows.forEach((row) => {
      const cellValue = row.cells[config.groupByColumnId];
      let groupKey: string | null = null;

      if (groupByColumn.type === 'select') {
        groupKey = (cellValue as string) || null;
      } else if (groupByColumn.type === 'multi_select') {
        // For multi-select, put in the first selected option's group
        // (or could duplicate across groups - this is a UX decision)
        const values = cellValue as string[] | null;
        groupKey = values && values.length > 0 ? values[0] : null;
      }

      const existingRows = groups.get(groupKey) ?? [];
      groups.set(groupKey, [...existingRows, row]);
    });

    // Convert to array and sort by option position
    const result: GroupedRows[] = [];

    // Add groups in option order
    groupOptions.forEach((option) => {
      // Skip hidden groups
      if (config.hiddenGroups?.includes(option.id)) return;

      const groupRows = groups.get(option.id);
      if (groupRows !== undefined && (groupRows.length > 0 || config.showEmptyGroups)) {
        result.push({
          groupValue: option.id,
          option,
          rows: sortRowsInGroup(groupRows, option.id),
        });
      }
    });

    // Add "No Status" group at the end (or beginning - UX decision)
    // Skip if hidden
    if (!config.hiddenGroups?.includes('__no_status__')) {
      const noStatusRows = groups.get(null) ?? [];
      if (noStatusRows.length > 0 || config.showEmptyGroups) {
        result.unshift({
          groupValue: null,
          rows: sortRowsInGroup(noStatusRows, null),
        });
      }
    }

    return result;
  }, [rows, groupByColumn, groupOptions, config.groupByColumnId, config.showEmptyGroups, config.hiddenGroups, sortRowsInGroup]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, rowId: string) => {
    setDraggingRowId(rowId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId);

    // Add a slight delay to allow the drag preview to be captured
    requestAnimationFrame(() => {
      const element = e.target as HTMLElement;
      if (element) {
        element.style.opacity = '0.5';
      }
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingRowId(null);
    setDragOverGroup(null);
    const element = e.target as HTMLElement;
    if (element) {
      element.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, groupValue: string | null) => {
      e.preventDefault();
      // Use a special key for null to differentiate from "not dragging over"
      const groupKey = groupValue ?? '__no_status__';
      if (dragOverGroup !== groupKey) {
        setDragOverGroup(groupKey);
      }
    },
    [dragOverGroup]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetGroupValue: string | null, targetIndex?: number) => {
      e.preventDefault();
      setDragOverGroup(null);

      if (!draggingRowId || readOnly || !onCellChange || !groupByColumn) {
        return;
      }

      // Find the row being dragged
      const draggedRow = rows.find((r) => r.id === draggingRowId);
      if (!draggedRow) return;

      // Determine the new value based on column type
      let newValue: CellValue;
      if (groupByColumn.type === 'select') {
        newValue = targetGroupValue;
      } else if (groupByColumn.type === 'multi_select') {
        // For multi-select, replace the first value or set as only value
        const currentValues = (draggedRow.cells[config.groupByColumnId] as string[]) || [];
        if (targetGroupValue === null) {
          // Remove all values
          newValue = [];
        } else if (currentValues.length === 0) {
          newValue = [targetGroupValue];
        } else {
          // Replace first value, keep others
          newValue = [targetGroupValue, ...currentValues.slice(1)];
        }
      } else {
        return; // Unsupported column type
      }

      // Update the cell value
      onCellChange(draggingRowId, config.groupByColumnId, newValue);

      // Update card order if target index provided
      if (targetIndex !== undefined && onConfigChange) {
        const groupKey = targetGroupValue ?? '__no_status__';
        const currentOrder = config.cardOrder?.[groupKey] ?? [];
        const newOrder = [...currentOrder];

        // Add the card at the target index
        if (!newOrder.includes(draggingRowId)) {
          newOrder.splice(targetIndex, 0, draggingRowId);
        }

        onConfigChange({
          ...config,
          cardOrder: {
            ...config.cardOrder,
            [groupKey]: newOrder,
          },
        });
      }

      setDraggingRowId(null);
    },
    [draggingRowId, readOnly, onCellChange, groupByColumn, rows, config, onConfigChange]
  );

  const handleCardReorder = useCallback(
    (groupValue: string | null, rowId: string, targetIndex: number) => {
      if (!onConfigChange) return;

      const groupKey = groupValue ?? '__no_status__';
      const group = groupedRows.find((g) => (g.groupValue ?? '__no_status__') === groupKey);
      if (!group) return;

      // Get current order or create from current rows
      const currentOrder = config.cardOrder?.[groupKey] ?? group.rows.map((r) => r.id);
      const newOrder = [...currentOrder];

      // Find current position and remove
      const currentIndex = newOrder.indexOf(rowId);
      if (currentIndex !== -1) {
        newOrder.splice(currentIndex, 1);
      }

      // Insert at new position
      const adjustedIndex = currentIndex !== -1 && currentIndex < targetIndex
        ? targetIndex - 1
        : targetIndex;
      newOrder.splice(Math.max(0, adjustedIndex), 0, rowId);

      onConfigChange({
        ...config,
        cardOrder: {
          ...config.cardOrder,
          [groupKey]: newOrder,
        },
      });
    },
    [config, onConfigChange, groupedRows]
  );

  const handleAddCard = useCallback(
    (groupValue: string | null) => {
      if (!onAddRow || !groupByColumn) return;

      // Create initial cell values with the group value
      const initialCells: Record<string, CellValue> = {};
      if (groupValue) {
        if (groupByColumn.type === 'select') {
          initialCells[config.groupByColumnId] = groupValue;
        } else if (groupByColumn.type === 'multi_select') {
          initialCells[config.groupByColumnId] = [groupValue];
        }
      }

      onAddRow(initialCells);
    },
    [onAddRow, groupByColumn, config.groupByColumnId]
  );

  // Card click handler
  const handleCardClick = useCallback(
    (rowId: string) => {
      if (onCardClick) {
        onCardClick(rowId);
      } else if (useBuiltInDetailPanel) {
        setSelectedRowId(rowId);
      }
    },
    [onCardClick, useBuiltInDetailPanel]
  );

  // Detail panel handlers
  const handleCloseDetailPanel = useCallback(() => {
    setSelectedRowId(null);
  }, []);

  const handleDetailCellChange = useCallback(
    (columnId: string, value: CellValue) => {
      if (selectedRowId && onCellChange) {
        onCellChange(selectedRowId, columnId, value);
      }
    },
    [selectedRowId, onCellChange]
  );

  const handleDetailDeleteRow = useCallback(() => {
    if (selectedRowId && onDeleteRow) {
      onDeleteRow(selectedRowId);
      setSelectedRowId(null);
    }
  }, [selectedRowId, onDeleteRow]);

  const handleDetailUploadFile = useCallback(
    async (columnId: string, file: File) => {
      if (selectedRowId && onUploadFile) {
        return onUploadFile(selectedRowId, columnId, file);
      }
      throw new Error('Upload not available');
    },
    [selectedRowId, onUploadFile]
  );

  const handleDetailDeleteFile = useCallback(
    async (columnId: string, fileId: string) => {
      if (selectedRowId && onDeleteFile) {
        return onDeleteFile(selectedRowId, columnId, fileId);
      }
    },
    [selectedRowId, onDeleteFile]
  );

  // Column menu handlers
  const handleSort = useCallback(
    (groupValue: string | null, order: BoardColumnSortOrder) => {
      if (!onConfigChange) return;

      const groupKey = groupValue ?? '__no_status__';
      onConfigChange({
        ...config,
        groupSortOrder: {
          ...config.groupSortOrder,
          [groupKey]: order,
        },
      });
    },
    [config, onConfigChange]
  );

  const handleCollapse = useCallback(
    (groupValue: string | null) => {
      if (!onConfigChange) return;

      const groupKey = groupValue ?? '__no_status__';
      const isCollapsed = config.collapsedGroups?.includes(groupKey);

      onConfigChange({
        ...config,
        collapsedGroups: isCollapsed
          ? config.collapsedGroups?.filter((g) => g !== groupKey)
          : [...(config.collapsedGroups ?? []), groupKey],
      });
    },
    [config, onConfigChange]
  );

  const handleHide = useCallback(
    (groupValue: string | null) => {
      if (!onConfigChange) return;

      const groupKey = groupValue ?? '__no_status__';
      onConfigChange({
        ...config,
        hiddenGroups: [...(config.hiddenGroups ?? []), groupKey],
      });
    },
    [config, onConfigChange]
  );

  // Add column handlers
  const handleStartAddColumn = useCallback(() => {
    setIsAddingColumn(true);
    setNewColumnName('');
    // Focus the input after render
    setTimeout(() => {
      addColumnInputRef.current?.focus();
    }, 0);
  }, []);

  const handleCancelAddColumn = useCallback(() => {
    setIsAddingColumn(false);
    setNewColumnName('');
  }, []);

  const handleCreateColumn = useCallback(async () => {
    if (!newColumnName.trim() || !onCreateSelectOption || !groupByColumn) return;

    setIsCreatingColumn(true);
    try {
      await onCreateSelectOption(config.groupByColumnId, newColumnName.trim());
      setIsAddingColumn(false);
      setNewColumnName('');
    } catch (error) {
      console.error('Failed to create column:', error);
    } finally {
      setIsCreatingColumn(false);
    }
  }, [newColumnName, onCreateSelectOption, groupByColumn, config.groupByColumnId]);

  const handleAddColumnKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreateColumn();
      } else if (e.key === 'Escape') {
        handleCancelAddColumn();
      }
    },
    [handleCreateColumn, handleCancelAddColumn]
  );

  // Get selected row for detail panel
  const selectedRow = useMemo(
    () => (selectedRowId ? rows.find((r) => r.id === selectedRowId) : null),
    [selectedRowId, rows]
  );

  // If no valid grouping column is configured
  if (!groupByColumn) {
    return (
      <div
        className={`dt-board-view ${className ?? ''}`}
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--dt-text-muted)',
          ...style,
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '14px' }}>
          No valid grouping column configured
        </div>
        <div style={{ fontSize: '12px' }}>
          Select a select or multi-select column to group by in the view settings.
        </div>
      </div>
    );
  }

  // Verify the grouping column is a select or multi_select type
  if (groupByColumn.type !== 'select' && groupByColumn.type !== 'multi_select') {
    return (
      <div
        className={`dt-board-view ${className ?? ''}`}
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--dt-text-muted)',
          ...style,
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '14px' }}>
          Invalid grouping column type
        </div>
        <div style={{ fontSize: '12px' }}>
          Board view requires a select or multi-select column for grouping.
          The column "{groupByColumn.name}" is of type "{groupByColumn.type}".
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`dt-board-view ${className ?? ''}`}
      style={{
        display: 'flex',
        gap: '16px',
        padding: '16px',
        overflowX: 'auto',
        minHeight: '400px',
        backgroundColor: 'var(--dt-bg-secondary)',
        ...style,
      }}
    >
      {/* Hide scrollbar CSS */}
      <style>{`
        .dt-board-view {
          scrollbar-width: thin;
          scrollbar-color: var(--dt-border-color-strong) transparent;
        }
        .dt-board-view::-webkit-scrollbar {
          height: 8px;
        }
        .dt-board-view::-webkit-scrollbar-track {
          background: transparent;
        }
        .dt-board-view::-webkit-scrollbar-thumb {
          background-color: var(--dt-border-color-strong);
          border-radius: 4px;
        }
        .dt-board-column-cards {
          scrollbar-width: thin;
          scrollbar-color: var(--dt-border-color-strong) transparent;
        }
        .dt-board-column-cards::-webkit-scrollbar {
          width: 6px;
        }
        .dt-board-column-cards::-webkit-scrollbar-track {
          background: transparent;
        }
        .dt-board-column-cards::-webkit-scrollbar-thumb {
          background-color: var(--dt-border-color-strong);
          border-radius: 3px;
        }
      `}</style>

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--dt-bg-primary)',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <span style={{ color: 'var(--dt-text-secondary)', fontSize: '14px' }}>Loading...</span>
        </div>
      )}

      {/* Board Columns */}
      {groupedRows.map((group) => {
        const groupKey = group.groupValue ?? '__no_status__';
        const isCollapsed = config.collapsedGroups?.includes(groupKey) ?? false;
        const sortOrder = config.groupSortOrder?.[groupKey] ?? 'manual';

        return (
          <BoardColumn
            key={groupKey}
            groupValue={group.groupValue}
            groupOption={group.option}
            rows={group.rows}
            columns={columns}
            cardProperties={config.cardProperties}
            selectOptions={selectOptions}
            onCardClick={handleCardClick}
            onDragStart={!readOnly ? handleDragStart : undefined}
            onDragEnd={!readOnly ? handleDragEnd : undefined}
            onDragOver={!readOnly ? handleDragOver : undefined}
            onDrop={!readOnly ? handleDrop : undefined}
            isDragOver={dragOverGroup === groupKey}
            onAddCard={onAddRow && !readOnly ? handleAddCard : undefined}
            isCollapsed={isCollapsed}
            sortOrder={sortOrder}
            onSort={onConfigChange ? handleSort : undefined}
            onCollapse={onConfigChange ? handleCollapse : undefined}
            onHide={onConfigChange ? handleHide : undefined}
            onCardReorder={onConfigChange && !readOnly ? handleCardReorder : undefined}
          />
        );
      })}

      {/* Add Column Button/Input */}
      {onCreateSelectOption && !readOnly && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: isAddingColumn ? '280px' : '44px',
            minWidth: isAddingColumn ? '280px' : '44px',
            transition: 'width 0.2s, min-width 0.2s',
          }}
        >
          {isAddingColumn ? (
            <div
              style={{
                backgroundColor: 'var(--dt-bg-tertiary)',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <input
                ref={addColumnInputRef}
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={handleAddColumnKeyDown}
                onBlur={() => {
                  // Delay to allow click on create button
                  setTimeout(() => {
                    if (!newColumnName.trim()) {
                      handleCancelAddColumn();
                    }
                  }, 150);
                }}
                placeholder="Column name..."
                disabled={isCreatingColumn}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--dt-border-color)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'var(--dt-bg-primary)',
                  color: 'var(--dt-text-primary)',
                  outline: 'none',
                  marginBottom: '8px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateColumn}
                  disabled={!newColumnName.trim() || isCreatingColumn}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: 'var(--dt-accent-primary)',
                    color: 'white',
                    fontSize: '13px',
                    cursor: newColumnName.trim() && !isCreatingColumn ? 'pointer' : 'not-allowed',
                    opacity: newColumnName.trim() && !isCreatingColumn ? 1 : 0.5,
                  }}
                >
                  {isCreatingColumn ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={handleCancelAddColumn}
                  disabled={isCreatingColumn}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--dt-border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    color: 'var(--dt-text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartAddColumn}
              title="Add column"
              style={{
                width: '44px',
                height: '44px',
                border: '2px dashed var(--dt-border-color)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '20px',
                color: 'var(--dt-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                e.currentTarget.style.borderColor = 'var(--dt-accent-primary)';
                e.currentTarget.style.color = 'var(--dt-accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--dt-border-color)';
                e.currentTarget.style.color = 'var(--dt-text-muted)';
              }}
            >
              +
            </button>
          )}
        </div>
      )}

      {/* Empty state when no columns */}
      {groupedRows.length === 0 && !onCreateSelectOption && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--dt-text-muted)',
            fontSize: '14px',
          }}
        >
          No groups to display. Add options to the "{groupByColumn.name}" column.
        </div>
      )}

      {/* Row Detail Panel */}
      {selectedRow && useBuiltInDetailPanel && (
        <RowDetailPanel
          row={selectedRow}
          columns={columns}
          selectOptions={selectOptions}
          isOpen={true}
          onClose={handleCloseDetailPanel}
          onCellChange={handleDetailCellChange}
          onDeleteRow={onDeleteRow ? handleDetailDeleteRow : undefined}
          readOnly={readOnly}
          onCreateSelectOption={onCreateSelectOption}
          onUpdateSelectOption={onUpdateSelectOption}
          onDeleteSelectOption={onDeleteSelectOption}
          onUploadFile={onUploadFile ? handleDetailUploadFile : undefined}
          onDeleteFile={onDeleteFile ? handleDetailDeleteFile : undefined}
          onSearchRelationRows={onSearchRelationRows}
          onGetRelationRowTitle={onGetRelationRowTitle}
        />
      )}
    </div>
  );
}
