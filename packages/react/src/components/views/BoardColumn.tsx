import { useCallback, useState, useRef } from 'react';
import type { Row, Column, SelectOption } from '@marlinjai/data-table-core';
import { BoardCard } from './BoardCard';
import { BoardColumnMenu, type BoardColumnSortOrder } from './BoardColumnMenu';

export interface BoardColumnProps {
  groupValue: string | null; // null for "No Status" column
  groupOption?: SelectOption; // The select option for this column (if any)
  rows: Row[];
  columns: Column[];
  cardProperties?: string[];
  selectOptions?: Map<string, SelectOption[]>;

  // Card interactions
  onCardClick?: (rowId: string) => void;

  // Drag and drop between columns
  onDragStart?: (e: React.DragEvent, rowId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, groupValue: string | null) => void;
  onDrop?: (e: React.DragEvent, groupValue: string | null, targetIndex?: number) => void;
  isDragOver?: boolean;

  // Row actions
  onAddCard?: (groupValue: string | null) => void;

  // Column menu features
  isCollapsed?: boolean;
  sortOrder?: BoardColumnSortOrder;
  onSort?: (groupValue: string | null, order: BoardColumnSortOrder) => void;
  onCollapse?: (groupValue: string | null) => void;
  onHide?: (groupValue: string | null) => void;

  // Card reordering within column
  onCardReorder?: (groupValue: string | null, rowId: string, targetIndex: number) => void;
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
  isCollapsed = false,
  sortOrder = 'manual',
  onSort,
  onCollapse,
  onHide,
  onCardReorder,
}: BoardColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      setDraggingRowId(rowId);
      e.dataTransfer.setData('text/plain', rowId);
      e.dataTransfer.setData('application/x-source-group', groupValue ?? '__no_status__');
      onDragStart?.(e, rowId);
    },
    [onDragStart, groupValue]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDraggingRowId(null);
      setDragOverIndex(null);
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

  const handleCardDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      const sourceGroup = e.dataTransfer.types.includes('application/x-source-group')
        ? undefined // Can't access data during dragover, will check on drop
        : undefined;

      setDragOverIndex(index);
      onDragOver?.(e, groupValue);
    },
    [onDragOver, groupValue]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex?: number) => {
      e.preventDefault();

      const rowId = e.dataTransfer.getData('text/plain');
      const sourceGroup = e.dataTransfer.getData('application/x-source-group');
      const currentGroup = groupValue ?? '__no_status__';

      // Check if this is a same-column reorder
      if (sourceGroup === currentGroup && onCardReorder && targetIndex !== undefined) {
        onCardReorder(groupValue, rowId, targetIndex);
      } else {
        // Cross-column drop
        onDrop?.(e, groupValue, targetIndex);
      }

      setDragOverIndex(null);
    },
    [onDrop, groupValue, onCardReorder]
  );

  const handleAddCard = useCallback(() => {
    onAddCard?.(groupValue);
  }, [onAddCard, groupValue]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.bottom + 4 });
    setMenuOpen(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleSort = useCallback(
    (order: BoardColumnSortOrder) => {
      onSort?.(groupValue, order);
    },
    [onSort, groupValue]
  );

  const handleCollapse = useCallback(() => {
    onCollapse?.(groupValue);
  }, [onCollapse, groupValue]);

  const handleHide = useCallback(() => {
    onHide?.(groupValue);
  }, [onHide, groupValue]);

  const colors = groupOption ? getColorStyles(groupOption.color) : TAG_COLORS.gray;
  const title = groupOption?.name ?? 'No Status';

  // Collapsed column view
  if (isCollapsed) {
    return (
      <div
        ref={columnRef}
        className="dt-board-column dt-board-column--collapsed"
        onClick={handleCollapse}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '40px',
          minWidth: '40px',
          maxHeight: '100%',
          backgroundColor: 'var(--dt-bg-tertiary)',
          borderRadius: '8px',
          border: '2px solid transparent',
          cursor: 'pointer',
          padding: '12px 0',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--dt-bg-tertiary)';
        }}
      >
        {/* Rotated title */}
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: '13px',
            fontWeight: 500,
            color: groupOption ? colors.text : 'var(--dt-text-secondary)',
            padding: '8px 0',
          }}
        >
          {title}
        </div>

        {/* Card count badge */}
        <div
          style={{
            marginTop: '8px',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: 'var(--dt-bg-selected)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--dt-text-secondary)',
          }}
        >
          {rows.length}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={columnRef}
      className="dt-board-column"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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

        {/* Menu button */}
        {(onSort || onCollapse || onHide) && (
          <button
            onClick={handleMenuClick}
            style={{
              padding: '4px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--dt-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
              e.currentTarget.style.color = 'var(--dt-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--dt-text-muted)';
            }}
          >
            &#8943;
          </button>
        )}
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
        {rows.map((row, index) => (
          <div
            key={row.id}
            onDragOver={(e) => handleCardDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
          >
            {/* Drop indicator before card */}
            {dragOverIndex === index && draggingRowId !== row.id && (
              <div
                style={{
                  height: '2px',
                  backgroundColor: 'var(--dt-accent-primary)',
                  marginBottom: '8px',
                  borderRadius: '1px',
                }}
              />
            )}
            <BoardCard
              row={row}
              columns={columns}
              cardProperties={cardProperties}
              selectOptions={selectOptions}
              onClick={onCardClick}
              isDragging={draggingRowId === row.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}

        {/* Drop indicator at end */}
        {dragOverIndex === rows.length && (
          <div
            style={{
              height: '2px',
              backgroundColor: 'var(--dt-accent-primary)',
              borderRadius: '1px',
            }}
          />
        )}

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
        {isDragOver && rows.length === 0 && (
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

        {/* Drop zone at end of list for reordering */}
        <div
          onDragOver={(e) => handleCardDragOver(e, rows.length)}
          onDrop={(e) => handleDrop(e, rows.length)}
          style={{
            minHeight: '20px',
            flex: rows.length === 0 ? 0 : 1,
          }}
        />
      </div>

      {/* Add Card Button */}
      {onAddCard && (
        <div
          style={{
            padding: '8px',
          }}
        >
          <button
            onClick={handleAddCard}
            title="Add card"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px dashed var(--dt-border-color)',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '18px',
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
        </div>
      )}

      {/* Column Menu */}
      {menuOpen && (
        <BoardColumnMenu
          groupValue={groupValue}
          cardCount={rows.length}
          isCollapsed={isCollapsed}
          sortOrder={sortOrder}
          position={menuPosition}
          onSort={handleSort}
          onCollapse={handleCollapse}
          onHide={handleHide}
          onClose={handleMenuClose}
        />
      )}
    </div>
  );
}
