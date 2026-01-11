import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type { Column, Row, CellValue, SelectOption, QuerySort, ColumnType, FileReference } from '@marlinjai/data-table-core';
import { CellRenderer } from './cells/CellRenderer';

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
  onAddProperty?: (name: string, type: ColumnType) => void;

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
  { value: 'relation', label: 'Relation', icon: '↔' },
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
  onAddProperty,
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
  className,
  style,
}: TableViewProps) {
  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    columns.forEach((col) => map.set(col.id, col.width));
    return map;
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<ColumnType>('text');
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

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

  return (
    <div
      className={`dt-table-view ${className ?? ''}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        position: 'relative',
        ...style,
      }}
    >
      {/* Hide scrollbar CSS */}
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
            <tr style={{ backgroundColor: '#f9fafb' }}>
              {onSelectionChange && (
                <th
                  style={{
                    width: '40px',
                    minWidth: '40px',
                    padding: '10px 8px',
                    borderBottom: '1px solid #e5e7eb',
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
              {columns.map((column) => {
                const sortDir = getSortDirection(column.id);
                const width = getColumnWidth(column.id);
                return (
                  <th
                    key={column.id}
                    style={{
                      width,
                      minWidth: width,
                      maxWidth: width,
                      padding: '10px 12px',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#374151',
                      cursor: onSortChange ? 'pointer' : 'default',
                      userSelect: 'none',
                      position: 'relative',
                    }}
                    onClick={() => handleSort(column.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {column.name}
                      </span>
                      {sortDir && (
                        <span style={{ color: '#2563eb', fontSize: '12px', flexShrink: 0 }}>
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
                        backgroundColor: resizingColumn === column.id ? '#2563eb' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!resizingColumn) e.currentTarget.style.backgroundColor = '#d1d5db';
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
                    borderBottom: '1px solid #e5e7eb',
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
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%',
                        }}
                      />
                      <select
                        value={newPropertyType}
                        onChange={(e) => setNewPropertyType(e.target.value as ColumnType)}
                        style={{
                          padding: '4px 6px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%',
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
                            backgroundColor: '#2563eb',
                            color: 'white',
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
                            backgroundColor: '#e5e7eb',
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
                        color: '#9ca3af',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#374151')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
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
                    borderBottom: '1px solid #e5e7eb',
                  }}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  backgroundColor: selectedRows.has(row.id) ? '#eff6ff' : 'white',
                }}
              >
                {onSelectionChange && (
                  <td
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid #e5e7eb',
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
                {columns.map((column) => {
                  const width = getColumnWidth(column.id);
                  return (
                    <td
                      key={column.id}
                      style={{
                        width,
                        minWidth: width,
                        maxWidth: width,
                        borderBottom: '1px solid #e5e7eb',
                        verticalAlign: 'middle',
                        overflow: column.type === 'select' || column.type === 'multi_select' || column.type === 'file' || column.type === 'relation' ? 'visible' : 'hidden',
                        position: column.type === 'select' || column.type === 'multi_select' || column.type === 'file' || column.type === 'relation' ? 'relative' : undefined,
                      }}
                    >
                      <CellRenderer
                        column={column}
                        value={row.cells[column.id]}
                        onChange={(value) => handleCellChange(row.id, column.id, value)}
                        selectOptions={selectOptions.get(column.id)}
                        readOnly={readOnly}
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
                    </td>
                  );
                })}
                {/* Empty cell for add property column */}
                {onAddProperty && (
                  <td
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  />
                )}
                {onDeleteRow && (
                  <td
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid #e5e7eb',
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
                        color: '#9ca3af',
                        fontSize: '14px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Empty state */}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={totalColumns}
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#9ca3af',
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
                    color: '#9ca3af',
                  }}
                >
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with Add Row and Load More */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        {onAddRow ? (
          <button
            onClick={onAddRow}
            style={{
              padding: '6px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#374151',
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
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              color: '#374151',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
