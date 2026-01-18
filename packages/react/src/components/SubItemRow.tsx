import { useCallback, memo } from 'react';
import type { Column, Row, CellValue, SelectOption, FileReference } from '@marlinjai/data-table-core';
import { CellRenderer } from './cells/CellRenderer';

export interface SubItemRowProps {
  row: Row;
  columns: Column[];
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  selectOptions?: Map<string, SelectOption[]>;
  readOnly?: boolean;

  // Column width getter
  getColumnWidth: (columnId: string) => number;

  // Callbacks
  onCellChange?: (rowId: string, columnId: string, value: CellValue) => void;
  onToggleExpand?: (rowId: string) => void;
  onSelectRow?: (rowId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onCreateSubItem?: (parentRowId: string) => void;

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

  // Show selection checkbox
  showSelection?: boolean;
  // Show delete button
  showDelete?: boolean;
  // Show add property column
  showAddProperty?: boolean;
}

const INDENT_PER_LEVEL = 24; // pixels per nesting level

export const SubItemRow = memo(function SubItemRow({
  row,
  columns,
  depth,
  hasChildren,
  isExpanded,
  isSelected,
  selectOptions = new Map(),
  readOnly = false,
  getColumnWidth,
  onCellChange,
  onToggleExpand,
  onSelectRow,
  onDeleteRow,
  onCreateSubItem,
  onCreateSelectOption,
  onUpdateSelectOption,
  onDeleteSelectOption,
  onUploadFile,
  onDeleteFile,
  onSearchRelationRows,
  onGetRelationRowTitle,
  showSelection = false,
  showDelete = false,
  showAddProperty = false,
}: SubItemRowProps) {
  const handleCellChange = useCallback(
    (columnId: string, value: CellValue) => {
      onCellChange?.(row.id, columnId, value);
    },
    [row.id, onCellChange]
  );

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand?.(row.id);
    },
    [row.id, onToggleExpand]
  );

  const handleSelectRow = useCallback(() => {
    onSelectRow?.(row.id);
  }, [row.id, onSelectRow]);

  const handleDeleteRow = useCallback(() => {
    onDeleteRow?.(row.id);
  }, [row.id, onDeleteRow]);

  const handleCreateSubItem = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreateSubItem?.(row.id);
    },
    [row.id, onCreateSubItem]
  );

  return (
    <tr
      style={{
        backgroundColor: isSelected ? '#eff6ff' : 'white',
      }}
    >
      {/* Selection checkbox */}
      {showSelection && (
        <td
          style={{
            padding: '4px 8px',
            borderBottom: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectRow}
            style={{ cursor: 'pointer' }}
          />
        </td>
      )}

      {/* Render each column cell */}
      {columns.map((column, colIndex) => {
        const width = getColumnWidth(column.id);
        const isFirstColumn = colIndex === 0;

        return (
          <td
            key={column.id}
            style={{
              width,
              minWidth: width,
              maxWidth: width,
              borderBottom: '1px solid #e5e7eb',
              verticalAlign: 'middle',
              overflow:
                column.type === 'select' ||
                column.type === 'multi_select' ||
                column.type === 'file' ||
                column.type === 'relation'
                  ? 'visible'
                  : 'hidden',
              position:
                column.type === 'select' ||
                column.type === 'multi_select' ||
                column.type === 'file' ||
                column.type === 'relation'
                  ? 'relative'
                  : undefined,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingLeft: isFirstColumn ? depth * INDENT_PER_LEVEL : 0,
              }}
            >
              {/* Expand/collapse toggle for first column */}
              {isFirstColumn && (
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
                      onClick={handleToggleExpand}
                      style={{
                        padding: '2px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#6b7280',
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
                        (e.currentTarget.style.backgroundColor = '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <span style={{ transform: 'rotate(90deg)', display: 'inline-block' }}>
                          &#9654;
                        </span>
                      ) : (
                        <span>&#9654;</span>
                      )}
                    </button>
                  ) : onCreateSubItem ? (
                    <button
                      onClick={handleCreateSubItem}
                      style={{
                        padding: '2px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#d1d5db',
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.color = '#6b7280';
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0';
                        e.currentTarget.style.color = '#d1d5db';
                        e.currentTarget.style.backgroundColor = 'transparent';
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
                  onChange={(value) => handleCellChange(column.id, value)}
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
              </div>
            </div>
          </td>
        );
      })}

      {/* Empty cell for add property column */}
      {showAddProperty && (
        <td
          style={{
            borderBottom: '1px solid #e5e7eb',
          }}
        />
      )}

      {/* Delete button */}
      {showDelete && (
        <td
          style={{
            padding: '4px 8px',
            borderBottom: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <button
            onClick={handleDeleteRow}
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
            x
          </button>
        </td>
      )}
    </tr>
  );
});

export default SubItemRow;
