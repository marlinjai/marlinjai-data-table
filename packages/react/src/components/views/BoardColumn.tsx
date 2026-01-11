import { useCallback, useState, useRef } from 'react';
import type { Row, Column, SelectOption } from '@marlinjai/data-table-core';
import { BoardCard } from './BoardCard';

export interface BoardColumnProps {
  groupValue: string | null; // null for "No Status" column
  groupOption?: SelectOption; // The select option for this column (if any)
  rows: Row[];
  columns: Column[];
  cardProperties?: string[];
  selectOptions?: Map<string, SelectOption[]>;

  // Card interactions
  onCardClick?: (rowId: string) => void;

  // Drag and drop
  onDragStart?: (e: React.DragEvent, rowId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, groupValue: string | null) => void;
  onDrop?: (e: React.DragEvent, groupValue: string | null) => void;
  isDragOver?: boolean;

  // Row actions
  onAddCard?: (groupValue: string | null) => void;
}

const DEFAULT_COLORS: Record<string, { bg: string; text: string }> = {
  gray: { bg: '#e5e7eb', text: '#374151' },
  red: { bg: '#fee2e2', text: '#991b1b' },
  orange: { bg: '#ffedd5', text: '#9a3412' },
  yellow: { bg: '#fef3c7', text: '#92400e' },
  green: { bg: '#dcfce7', text: '#166534' },
  blue: { bg: '#dbeafe', text: '#1e40af' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  pink: { bg: '#fce7f3', text: '#9d174d' },
  brown: { bg: '#fae5d3', text: '#7c4a03' },
};

function getColorStyles(color?: string): { bg: string; text: string } {
  if (!color) return DEFAULT_COLORS.gray;
  return DEFAULT_COLORS[color] ?? DEFAULT_COLORS.gray;
}

export function BoardColumn({
  groupValue,
  groupOption,
  rows,
  columns,
  cardProperties,
  selectOptions = new Map(),
  onCardClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver = false,
  onAddCard,
}: BoardColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      setDraggingRowId(rowId);
      onDragStart?.(e, rowId);
    },
    [onDragStart]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDraggingRowId(null);
      onDragEnd?.(e);
    },
    [onDragEnd]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver?.(e, groupValue);
    },
    [onDragOver, groupValue]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDrop?.(e, groupValue);
    },
    [onDrop, groupValue]
  );

  const handleAddCard = useCallback(() => {
    onAddCard?.(groupValue);
  }, [onAddCard, groupValue]);

  const colors = groupOption ? getColorStyles(groupOption.color) : DEFAULT_COLORS.gray;
  const title = groupOption?.name ?? 'No Status';

  return (
    <div
      ref={columnRef}
      className="dt-board-column"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '280px',
        minWidth: '280px',
        maxHeight: '100%',
        backgroundColor: isDragOver ? '#f0f9ff' : '#f3f4f6',
        borderRadius: '8px',
        border: isDragOver ? '2px dashed #2563eb' : '2px solid transparent',
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      {/* Column Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {groupOption ? (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            >
              {title}
            </span>
          ) : (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#6b7280',
              }}
            >
              {title}
            </span>
          )}
          <span
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: 400,
            }}
          >
            {rows.length}
          </span>
        </div>
      </div>

      {/* Cards Container */}
      <div
        className="dt-board-column-cards"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {rows.map((row) => (
          <BoardCard
            key={row.id}
            row={row}
            columns={columns}
            cardProperties={cardProperties}
            selectOptions={selectOptions}
            onClick={onCardClick}
            isDragging={draggingRowId === row.id}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* Empty state */}
        {rows.length === 0 && !isDragOver && (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
            }}
          >
            No items
          </div>
        )}

        {/* Drop indicator when dragging */}
        {isDragOver && (
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: '2px dashed #2563eb',
              backgroundColor: '#dbeafe',
              textAlign: 'center',
              color: '#2563eb',
              fontSize: '13px',
            }}
          >
            Drop here
          </div>
        )}
      </div>

      {/* Add Card Button */}
      {onAddCard && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button
            onClick={handleAddCard}
            style={{
              width: '100%',
              padding: '8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>+</span>
            <span>Add card</span>
          </button>
        </div>
      )}
    </div>
  );
}
