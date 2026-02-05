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

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  gray: { bg: 'var(--dt-tag-gray-bg)', text: 'var(--dt-tag-gray-text)' },
  red: { bg: 'var(--dt-tag-red-bg)', text: 'var(--dt-tag-red-text)' },
  orange: { bg: 'var(--dt-tag-orange-bg)', text: 'var(--dt-tag-orange-text)' },
  yellow: { bg: 'var(--dt-tag-yellow-bg)', text: 'var(--dt-tag-yellow-text)' },
  green: { bg: 'var(--dt-tag-green-bg)', text: 'var(--dt-tag-green-text)' },
  blue: { bg: 'var(--dt-tag-blue-bg)', text: 'var(--dt-tag-blue-text)' },
  purple: { bg: 'var(--dt-tag-purple-bg)', text: 'var(--dt-tag-purple-text)' },
  pink: { bg: 'var(--dt-tag-pink-bg)', text: 'var(--dt-tag-pink-text)' },
  brown: { bg: 'var(--dt-tag-brown-bg)', text: 'var(--dt-tag-brown-text)' },
};

function getColorStyles(color?: string): { bg: string; text: string } {
  if (!color) return TAG_COLORS.gray;
  return TAG_COLORS[color] ?? TAG_COLORS.gray;
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

  const colors = groupOption ? getColorStyles(groupOption.color) : TAG_COLORS.gray;
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
        backgroundColor: isDragOver ? 'var(--dt-bg-selected)' : 'var(--dt-bg-tertiary)',
        borderRadius: '8px',
        border: isDragOver ? '2px dashed var(--dt-accent-primary)' : '2px solid transparent',
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
          borderBottom: '1px solid var(--dt-border-color)',
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
                color: 'var(--dt-text-secondary)',
              }}
            >
              {title}
            </span>
          )}
          <span
            style={{
              fontSize: '12px',
              color: 'var(--dt-text-muted)',
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
              color: 'var(--dt-text-muted)',
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
              border: '2px dashed var(--dt-accent-primary)',
              backgroundColor: 'var(--dt-bg-selected)',
              textAlign: 'center',
              color: 'var(--dt-accent-primary)',
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
            borderTop: '1px solid var(--dt-border-color)',
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
              color: 'var(--dt-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
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
