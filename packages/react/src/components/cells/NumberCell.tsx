import { useState, useCallback, useRef, useEffect } from 'react';
import type { NumberColumnConfig } from '@marlinjai/data-table-core';

export interface NumberCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  config?: NumberColumnConfig;
  readOnly?: boolean;
}

function formatNumber(value: number | null, config?: NumberColumnConfig): string {
  if (value === null || value === undefined) return '';

  const format = config?.format ?? 'number';
  const precision = config?.precision ?? 2;

  switch (format) {
    case 'currency': {
      const currencyCode = config?.currencyCode ?? 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value);
    }
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value / 100);
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision,
      }).format(value);
  }
}

export function NumberCell({ value, onChange, config, readOnly }: NumberCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (!readOnly) {
      setEditValue(value?.toString() ?? '');
      setIsEditing(true);
    }
  }, [readOnly, value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const parsed = editValue === '' ? null : parseFloat(editValue);
    if (parsed !== value && (parsed === null || !isNaN(parsed))) {
      // Validate min/max
      let finalValue = parsed;
      if (finalValue !== null) {
        if (config?.min !== undefined && finalValue < config.min) {
          finalValue = config.min;
        }
        if (config?.max !== undefined && finalValue > config.max) {
          finalValue = config.max;
        }
      }
      onChange(finalValue);
    }
  }, [editValue, value, onChange, config]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        setEditValue(value?.toString() ?? '');
        setIsEditing(false);
      }
    },
    [handleBlur, value]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={config?.min}
        max={config?.max}
        step={config?.precision ? Math.pow(10, -config.precision) : 'any'}
        className="dt-cell-input"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          padding: '4px 8px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          backgroundColor: 'transparent',
          textAlign: 'right',
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="dt-cell-number"
      style={{
        padding: '4px 8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: readOnly ? 'default' : 'text',
        textAlign: 'right',
        minHeight: '24px',
      }}
    >
      {formatNumber(value, config)}
    </div>
  );
}
