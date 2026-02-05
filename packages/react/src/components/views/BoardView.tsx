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

export interface BoardViewProps {
  columns: Column[];
  rows: Row[];
  selectOptions?: Map<string, SelectOption[]>;

  // Board configuration
  config: BoardViewConfig;

  // Cell editing (for drag-and-drop updates)
  onCellChange?: (rowId: string, columnId: string, value: CellValue) => void;
  readOnly?: boolean;

  // Row actions
  onAddRow?: (initialCellValues?: Record<string, CellValue>) => void;
  onDeleteRow?: (rowId: string) => void;

  // Card click
  onCardClick?: (rowId: string) => void;

  // Select option management
  onCreateSelectOption?: (columnId: string, name: string, color?: string) => Promise<SelectOption>;
  onUpdateSelectOption?: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  onDeleteSelectOption?: (columnId: string, optionId: string) => Promise<void>;

  // File operations
  onUploadFile?: (rowId: string, columnId: string, file: File) => Promise<FileReference>;
  onDeleteFile?: (rowId: string, columnId: string, fileId: string) => Promise<void>;

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
  onCellChange,
  readOnly = false,
  onAddRow,
  onDeleteRow,
  onCardClick,
  onCreateSelectOption,
  onUpdateSelectOption,
  onDeleteSelectOption,
  onUploadFile,
  onDeleteFile,
  isLoading,
  className,
  style,
}: BoardViewProps) {
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const groupRows = groups.get(option.id);
      if (groupRows !== undefined && (groupRows.length > 0 || config.showEmptyGroups)) {
        result.push({
          groupValue: option.id,
          option,
          rows: groupRows,
        });
      }
    });

    // Add "No Status" group at the end (or beginning - UX decision)
    const noStatusRows = groups.get(null) ?? [];
    if (noStatusRows.length > 0 || config.showEmptyGroups) {
      result.unshift({
        groupValue: null,
        rows: noStatusRows,
      });
    }

    return result;
  }, [rows, groupByColumn, groupOptions, config.groupByColumnId, config.showEmptyGroups]);

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
    (e: React.DragEvent, targetGroupValue: string | null) => {
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
      setDraggingRowId(null);
    },
    [draggingRowId, readOnly, onCellChange, groupByColumn, rows, config.groupByColumnId]
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
        return (
          <BoardColumn
            key={groupKey}
            groupValue={group.groupValue}
            groupOption={group.option}
            rows={group.rows}
            columns={columns}
            cardProperties={config.cardProperties}
            selectOptions={selectOptions}
            onCardClick={onCardClick}
            onDragStart={!readOnly ? handleDragStart : undefined}
            onDragEnd={!readOnly ? handleDragEnd : undefined}
            onDragOver={!readOnly ? handleDragOver : undefined}
            onDrop={!readOnly ? handleDrop : undefined}
            isDragOver={dragOverGroup === groupKey}
            onAddCard={onAddRow && !readOnly ? handleAddCard : undefined}
          />
        );
      })}

      {/* Empty state when no columns */}
      {groupedRows.length === 0 && (
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
    </div>
  );
}
