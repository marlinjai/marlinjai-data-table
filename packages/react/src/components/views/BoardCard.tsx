import { useCallback, useMemo } from 'react';
import type { Row, Column, CellValue, SelectOption } from '@marlinjai/data-table-core';

export interface BoardCardProps {
  row: Row;
  columns: Column[];
  cardProperties?: string[]; // columnIds to display on card
  selectOptions?: Map<string, SelectOption[]>;
  onClick?: (rowId: string) => void;

  // Drag and drop
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, rowId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
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

function formatCellValue(value: CellValue, column: Column): string {
  if (value === null || value === undefined) return '';

  switch (column.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toLocaleDateString();
      }
      return String(value);
    case 'number':
      return String(value);
    default:
      return String(value);
  }
}

export function BoardCard({
  row,
  columns,
  cardProperties,
  selectOptions = new Map(),
  onClick,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: BoardCardProps) {
  // Get the primary column (title)
  const primaryColumn = useMemo(
    () => columns.find((col) => col.isPrimary) ?? columns[0],
    [columns]
  );

  // Get columns to display on card
  const displayColumns = useMemo(() => {
    if (!cardProperties || cardProperties.length === 0) {
      // Default: show first few non-primary columns
      return columns
        .filter((col) => !col.isPrimary && col.type !== 'select' && col.type !== 'multi_select')
        .slice(0, 3);
    }
    return columns.filter(
      (col) => cardProperties.includes(col.id) && !col.isPrimary
    );
  }, [columns, cardProperties]);

  const handleClick = useCallback(() => {
    onClick?.(row.id);
  }, [onClick, row.id]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart?.(e, row.id);
    },
    [onDragStart, row.id]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      onDragEnd?.(e);
    },
    [onDragEnd]
  );

  const title = primaryColumn ? row.cells[primaryColumn.id] : '';

  return (
    <div
      className="dt-board-card"
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      style={{
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        boxShadow: isDragging
          ? '0 8px 16px -2px rgba(0, 0, 0, 0.15)'
          : '0 1px 2px rgba(0, 0, 0, 0.05)',
        cursor: onDragStart ? 'grab' : onClick ? 'pointer' : 'default',
        opacity: isDragging ? 0.9 : 1,
        transform: isDragging ? 'rotate(3deg)' : 'none',
        transition: 'box-shadow 0.2s, transform 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 4px 8px -2px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
        }
      }}
    >
      {/* Card Title */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#111827',
          marginBottom: displayColumns.length > 0 ? '8px' : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title ? String(title) : 'Untitled'}
      </div>

      {/* Card Properties */}
      {displayColumns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {displayColumns.map((column) => {
            const value = row.cells[column.id];

            // Handle select/multi-select with tags
            if (column.type === 'select' && value) {
              const options = selectOptions.get(column.id) ?? [];
              const option = options.find((opt) => opt.id === value);
              if (option) {
                const colors = getColorStyles(option.color);
                return (
                  <div key={column.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        flexShrink: 0,
                      }}
                    >
                      {column.name}:
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: colors.bg,
                        color: colors.text,
                      }}
                    >
                      {option.name}
                    </span>
                  </div>
                );
              }
            }

            // Handle multi-select with multiple tags
            if (column.type === 'multi_select' && Array.isArray(value) && value.length > 0) {
              const options = selectOptions.get(column.id) ?? [];
              const valueArray = value as string[];
              const selectedOptions = options.filter((opt) => valueArray.includes(opt.id));
              return (
                <div key={column.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      flexShrink: 0,
                      paddingTop: '2px',
                    }}
                  >
                    {column.name}:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {selectedOptions.map((option) => {
                      const colors = getColorStyles(option.color);
                      return (
                        <span
                          key={option.id}
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                        >
                          {option.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Handle other types
            const displayValue = formatCellValue(value, column);
            if (!displayValue) return null;

            return (
              <div
                key={column.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#6b7280', flexShrink: 0 }}>{column.name}:</span>
                <span
                  style={{
                    color: '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
