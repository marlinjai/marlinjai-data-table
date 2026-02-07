import { useState, useCallback, useRef, useEffect } from 'react';
import type { DateColumnConfig, TextAlignment } from '@marlinjai/data-table-core';

export interface DateCellProps {
  value: Date | string | null;
  onChange: (value: Date | null) => void;
  config?: DateColumnConfig;
  readOnly?: boolean;
  alignment?: TextAlignment;
}

function formatDate(value: Date | string | null, config?: DateColumnConfig): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';

  const includeTime = config?.includeTime ?? false;

  if (includeTime) {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toInputValue(value: Date | string | null, includeTime?: boolean): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';

  if (includeTime) {
    // Format for datetime-local input
    return date.toISOString().slice(0, 16);
  }

  // Format for date input
  return date.toISOString().slice(0, 10);
}

export function DateCell({ value, onChange, config, readOnly, alignment = 'left' }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const includeTime = config?.includeTime ?? false;
  const [editValue, setEditValue] = useState(toInputValue(value, includeTime));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (!readOnly) {
      setEditValue(toInputValue(value, includeTime));
      setIsEditing(true);
    }
  }, [readOnly, value, includeTime]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue === '') {
      onChange(null);
    } else {
      const newDate = new Date(editValue);
      if (!isNaN(newDate.getTime())) {
        onChange(newDate);
      }
    }
  }, [editValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        setEditValue(toInputValue(value, includeTime));
        setIsEditing(false);
      }
    },
    [handleBlur, value, includeTime]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={includeTime ? 'datetime-local' : 'date'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
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
          textAlign: alignment,
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="dt-cell-date"
      style={{
        padding: '4px 8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: readOnly ? 'default' : 'text',
        minHeight: '24px',
        textAlign: alignment,
      }}
    >
      {formatDate(value, config)}
    </div>
  );
}
