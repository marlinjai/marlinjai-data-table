import { useCallback, useEffect, useRef } from 'react';
import type {
  Row,
  Column,
  CellValue,
  SelectOption,
  FileReference,
} from '@marlinjai/data-table-core';
import { CellRenderer } from '../cells';

export interface RowDetailPanelProps {
  row: Row;
  columns: Column[];
  selectOptions: Map<string, SelectOption[]>;
  isOpen: boolean;
  onClose: () => void;
  onCellChange: (columnId: string, value: CellValue) => void;
  onDeleteRow?: () => void;
  readOnly?: boolean;
  // Select option management
  onCreateSelectOption?: (columnId: string, name: string, color?: string) => Promise<SelectOption>;
  onUpdateSelectOption?: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  onDeleteSelectOption?: (columnId: string, optionId: string) => Promise<void>;
  // File operations
  onUploadFile?: (columnId: string, file: File) => Promise<FileReference>;
  onDeleteFile?: (columnId: string, fileId: string) => Promise<void>;
  // Relation operations
  onSearchRelationRows?: (tableId: string, query: string) => Promise<Row[]>;
  onGetRelationRowTitle?: (tableId: string, rowId: string) => Promise<string>;
  // Styling
  width?: number;
}

export function RowDetailPanel({
  row,
  columns,
  selectOptions,
  isOpen,
  onClose,
  onCellChange,
  onDeleteRow,
  readOnly = false,
  onCreateSelectOption,
  onUpdateSelectOption,
  onDeleteSelectOption,
  onUploadFile,
  onDeleteFile,
  onSearchRelationRows,
  onGetRelationRowTitle,
  width = 400,
}: RowDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Get the primary column for the title
  const primaryColumn = columns.find((col) => col.isPrimary) ?? columns[0];
  const title = primaryColumn ? (row.cells[primaryColumn.id] as string) : 'Untitled';

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding the listener to avoid immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCellChange = useCallback(
    (columnId: string) => (value: CellValue) => {
      onCellChange(columnId, value);
    },
    [onCellChange]
  );

  const handleCreateOption = useCallback(
    (columnId: string) => async (name: string, color?: string) => {
      if (!onCreateSelectOption) throw new Error('onCreateSelectOption not provided');
      return onCreateSelectOption(columnId, name, color);
    },
    [onCreateSelectOption]
  );

  const handleDeleteOption = useCallback(
    (columnId: string) => async (optionId: string) => {
      if (!onDeleteSelectOption) throw new Error('onDeleteSelectOption not provided');
      return onDeleteSelectOption(columnId, optionId);
    },
    [onDeleteSelectOption]
  );

  const handleUploadFile = useCallback(
    (columnId: string) => async (file: File) => {
      if (!onUploadFile) throw new Error('onUploadFile not provided');
      return onUploadFile(columnId, file);
    },
    [onUploadFile]
  );

  const handleDeleteFile = useCallback(
    (columnId: string) => async (fileId: string) => {
      if (!onDeleteFile) throw new Error('onDeleteFile not provided');
      return onDeleteFile(columnId, fileId);
    },
    [onDeleteFile]
  );

  if (!isOpen) return null;

  // Sort columns: primary first, then by position
  const sortedColumns = [...columns].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return a.position - b.position;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 999,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="dt-row-detail-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: `${width}px`,
          backgroundColor: 'var(--dt-bg-primary)',
          borderLeft: '1px solid var(--dt-border-color)',
          boxShadow: 'var(--dt-shadow-lg)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Animation styles */}
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
          .dt-row-detail-panel {
            scrollbar-width: thin;
            scrollbar-color: var(--dt-border-color-strong) transparent;
          }
          .dt-row-detail-panel::-webkit-scrollbar {
            width: 6px;
          }
          .dt-row-detail-panel::-webkit-scrollbar-track {
            background: transparent;
          }
          .dt-row-detail-panel::-webkit-scrollbar-thumb {
            background-color: var(--dt-border-color-strong);
            border-radius: 3px;
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--dt-border-color)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--dt-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              marginRight: '12px',
            }}
          >
            {title || 'Untitled'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onDeleteRow && !readOnly && (
              <button
                onClick={onDeleteRow}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--dt-text-danger, #dc2626)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--dt-bg-danger-light, #fef2f2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '6px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: 'var(--dt-text-secondary)',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Properties List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {sortedColumns.map((column) => {
            const value = row.cells[column.id];
            const options = selectOptions.get(column.id) ?? [];
            const isReadOnlyColumn =
              readOnly ||
              column.type === 'formula' ||
              column.type === 'rollup' ||
              column.type === 'created_time' ||
              column.type === 'last_edited_time';

            return (
              <div
                key={column.id}
                style={{
                  marginBottom: '16px',
                }}
              >
                {/* Column Name Label */}
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--dt-text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {column.name}
                </div>

                {/* Cell Editor */}
                <div
                  style={{
                    border: '1px solid var(--dt-border-color)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--dt-bg-secondary)',
                    minHeight: '36px',
                    display: 'flex',
                    alignItems: 'stretch',
                  }}
                >
                  <div style={{ flex: 1, padding: '4px 8px' }}>
                    <CellRenderer
                      column={column}
                      value={value}
                      onChange={handleCellChange(column.id)}
                      selectOptions={options}
                      readOnly={isReadOnlyColumn}
                      onCreateOption={onCreateSelectOption ? handleCreateOption(column.id) : undefined}
                      onUpdateOption={onUpdateSelectOption}
                      onDeleteOption={onDeleteSelectOption ? handleDeleteOption(column.id) : undefined}
                      onUploadFile={onUploadFile ? handleUploadFile(column.id) : undefined}
                      onDeleteFile={onDeleteFile ? handleDeleteFile(column.id) : undefined}
                      onSearchRelationRows={onSearchRelationRows}
                      onGetRelationRowTitle={onGetRelationRowTitle}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with row metadata */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--dt-border-color)',
            fontSize: '11px',
            color: 'var(--dt-text-muted)',
            flexShrink: 0,
          }}
        >
          <div>Created: {row.createdAt instanceof Date ? row.createdAt.toLocaleString() : new Date(row.createdAt).toLocaleString()}</div>
          <div>Updated: {row.updatedAt instanceof Date ? row.updatedAt.toLocaleString() : new Date(row.updatedAt).toLocaleString()}</div>
        </div>
      </div>
    </>
  );
}
