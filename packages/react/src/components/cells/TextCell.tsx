import { useState, useCallback, useRef, useEffect } from 'react';
import type { TextColumnConfig } from '@marlinjai/data-table-core';

export interface TextCellProps {
  value: string | null;
  onChange: (value: string) => void;
  config?: TextColumnConfig;
  readOnly?: boolean;
}

export function TextCell({ value, onChange, config, readOnly }: TextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (!readOnly) {
      setEditValue(value ?? '');
      setIsEditing(true);
    }
  }, [readOnly, value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        setEditValue(value ?? '');
        setIsEditing(false);
      }
    },
    [handleBlur, value]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={config?.maxLength}
        placeholder={config?.placeholder}
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
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="dt-cell-text"
      style={{
        padding: '4px 8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: readOnly ? 'default' : 'text',
        minHeight: '24px',
      }}
    >
      {value || <span style={{ color: '#999' }}>{config?.placeholder || ''}</span>}
    </div>
  );
}
