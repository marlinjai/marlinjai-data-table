import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Row } from '@marlinjai/data-table-core';

export interface RelationPickerProps {
  targetTableId: string;
  selectedRowIds: string[];
  onSelect: (rowId: string, displayValue: string) => void;
  onDeselect: (rowId: string) => void;
  onClose: () => void;
  limitType: 'single' | 'multiple';
  position: { top: number; left: number };
  onSearchRows: (query: string) => Promise<Row[]>;
}

export function RelationPicker({
  targetTableId,
  selectedRowIds,
  onSelect,
  onDeselect,
  onClose,
  limitType,
  position,
  onSearchRows,
}: RelationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Search rows when query changes
  useEffect(() => {
    let cancelled = false;

    const search = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await onSearchRows(searchQuery);
        if (!cancelled) {
          setRows(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load rows');
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    search();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, onSearchRows]);

  const handleRowClick = useCallback(
    (row: Row) => {
      const isSelected = selectedRowIds.includes(row.id);

      if (isSelected) {
        onDeselect(row.id);
      } else {
        // Get display value from the first text cell or use row id
        const displayValue = getRowDisplayValue(row);
        onSelect(row.id, displayValue);

        // Close picker for single selection mode
        if (limitType === 'single') {
          onClose();
        }
      }
    },
    [selectedRowIds, onSelect, onDeselect, limitType, onClose]
  );

  // Sort rows to show selected ones at top
  const sortedRows = [...rows].sort((a, b) => {
    const aSelected = selectedRowIds.includes(a.id);
    const bSelected = selectedRowIds.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  return createPortal(
    <div
      ref={pickerRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        width: '300px',
        maxHeight: '400px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search input */}
      <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search rows..."
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
          onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
        />
      </div>

      {/* Rows list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '340px',
        }}
      >
        {isLoading ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
            }}
          >
            Loading...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#ef4444',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        ) : sortedRows.length === 0 ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
            }}
          >
            {searchQuery ? 'No matching rows' : 'No rows available'}
          </div>
        ) : (
          sortedRows.map((row) => {
            const isSelected = selectedRowIds.includes(row.id);
            const displayValue = getRowDisplayValue(row);

            return (
              <div
                key={row.id}
                onClick={() => handleRowClick(row)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f3f4f6',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : 'transparent';
                }}
              >
                {/* Checkbox or radio based on limitType */}
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                    borderRadius: limitType === 'single' ? '50%' : '4px',
                    backgroundColor: isSelected ? '#2563eb' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                    >
                      <path d="M2 5 L4 7 L8 3" />
                    </svg>
                  )}
                </div>

                {/* Row display value */}
                <div
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    color: '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayValue || (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                      Untitled
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer with selection count for multiple selection */}
      {limitType === 'multiple' && selectedRowIds.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{selectedRowIds.length} selected</span>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            Done
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * Extract a display value from a row
 * Uses the first non-empty text/number value found
 */
function getRowDisplayValue(row: Row): string {
  // Check cells for a display value
  for (const [, cellValue] of Object.entries(row.cells)) {
    if (typeof cellValue === 'string' && cellValue.trim()) {
      return cellValue;
    }
    if (typeof cellValue === 'number') {
      return String(cellValue);
    }
  }
  return '';
}
