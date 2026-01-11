import { useState, useCallback, useRef, useEffect } from 'react';
import type { Row, RelationValue, RelationColumnConfig } from '@marlinjai/data-table-core';
import { RelationPicker } from '../relations/RelationPicker';

export interface RelationCellProps {
  value: RelationValue[] | null;
  onChange: (value: RelationValue[]) => void;
  config: RelationColumnConfig;
  readOnly?: boolean;
  // Callbacks for fetching data
  onSearchRows?: (tableId: string, query: string) => Promise<Row[]>;
  onGetRowTitle?: (tableId: string, rowId: string) => Promise<string>;
}

const CHIP_COLORS = {
  bg: '#e0e7ff',
  text: '#3730a3',
  hover: '#c7d2fe',
};

export function RelationCell({
  value,
  onChange,
  config,
  readOnly = false,
  onSearchRows,
  onGetRowTitle,
}: RelationCellProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const [displayValues, setDisplayValues] = useState<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const relations = value ?? [];
  const isSingle = config.limitType === 'single';

  // Fetch display values for relations that don't have cached displayValue
  useEffect(() => {
    if (!onGetRowTitle || !config.targetTableId) return;

    const fetchMissingDisplayValues = async () => {
      const updates = new Map<string, string>();

      for (const relation of relations) {
        // Use cached displayValue if available
        if (relation.displayValue) {
          updates.set(relation.rowId, relation.displayValue);
        } else if (!displayValues.has(relation.rowId)) {
          try {
            const title = await onGetRowTitle(config.targetTableId, relation.rowId);
            updates.set(relation.rowId, title);
          } catch {
            updates.set(relation.rowId, 'Unknown');
          }
        }
      }

      if (updates.size > 0) {
        setDisplayValues((prev) => {
          const newMap = new Map(prev);
          updates.forEach((val, key) => newMap.set(key, val));
          return newMap;
        });
      }
    };

    fetchMissingDisplayValues();
  }, [relations, onGetRowTitle, config.targetTableId, displayValues]);

  const handleOpenPicker = useCallback(() => {
    if (readOnly || !onSearchRows) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 2,
        left: rect.left,
      });
    }
    setIsPickerOpen(true);
  }, [readOnly, onSearchRows]);

  const handleClosePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const handleSelect = useCallback(
    (rowId: string, displayValue: string) => {
      // Update local display values cache
      setDisplayValues((prev) => new Map(prev).set(rowId, displayValue));

      const newRelation: RelationValue = { rowId, displayValue };

      if (isSingle) {
        // Replace existing relation for single mode
        onChange([newRelation]);
      } else {
        // Add to existing relations for multiple mode
        const exists = relations.some((r) => r.rowId === rowId);
        if (!exists) {
          onChange([...relations, newRelation]);
        }
      }
    },
    [isSingle, relations, onChange]
  );

  const handleDeselect = useCallback(
    (rowId: string) => {
      onChange(relations.filter((r) => r.rowId !== rowId));
    },
    [relations, onChange]
  );

  const handleRemoveChip = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.stopPropagation();
      if (!readOnly) {
        handleDeselect(rowId);
      }
    },
    [readOnly, handleDeselect]
  );

  const handleSearchRows = useCallback(
    async (query: string): Promise<Row[]> => {
      if (!onSearchRows) return [];
      return onSearchRows(config.targetTableId, query);
    },
    [onSearchRows, config.targetTableId]
  );

  const getDisplayValue = (relation: RelationValue): string => {
    // Priority: cached displayValue > local displayValues map
    return relation.displayValue ?? displayValues.get(relation.rowId) ?? 'Loading...';
  };

  const selectedRowIds = relations.map((r) => r.rowId);

  return (
    <div
      ref={containerRef}
      className="dt-cell-relation"
      style={{
        position: 'relative',
        padding: '4px 8px',
        minHeight: '24px',
        cursor: readOnly ? 'default' : 'pointer',
      }}
      onClick={handleOpenPicker}
    >
      {/* Display chips/pills for linked rows */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        {relations.length === 0 ? (
          // Empty state
          <span
            style={{
              color: '#9ca3af',
              fontSize: '13px',
            }}
          >
            {readOnly ? 'No links' : onSearchRows ? 'Add link...' : 'No links'}
          </span>
        ) : (
          // Relation chips
          relations.map((relation) => (
            <div
              key={relation.rowId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: CHIP_COLORS.bg,
                color: CHIP_COLORS.text,
                borderRadius: '4px',
                fontSize: '13px',
                maxWidth: '180px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = CHIP_COLORS.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = CHIP_COLORS.bg;
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getDisplayValue(relation)}
              </span>

              {/* Remove button */}
              {!readOnly && (
                <button
                  onClick={(e) => handleRemoveChip(e, relation.rowId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: CHIP_COLORS.text,
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M2 2 L8 8 M8 2 L2 8" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}

        {/* Add button when there are existing relations and multiple selection is allowed */}
        {!readOnly && onSearchRows && relations.length > 0 && !isSingle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPicker();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              border: '1px dashed #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: '14px',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Relation Picker Portal */}
      {isPickerOpen && onSearchRows && (
        <RelationPicker
          targetTableId={config.targetTableId}
          selectedRowIds={selectedRowIds}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onClose={handleClosePicker}
          limitType={config.limitType ?? 'multiple'}
          position={pickerPosition}
          onSearchRows={handleSearchRows}
        />
      )}
    </div>
  );
}
