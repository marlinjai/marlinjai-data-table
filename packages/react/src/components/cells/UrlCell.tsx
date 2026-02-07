import { useState, useCallback, useRef, useEffect } from 'react';
import type { UrlColumnConfig, TextAlignment } from '@marlinjai/data-table-core';

export interface UrlCellProps {
  value: string | null;
  onChange: (value: string) => void;
  config?: UrlColumnConfig;
  readOnly?: boolean;
  alignment?: TextAlignment;
}

export function UrlCell({ value, onChange, config, readOnly, alignment = 'left' }: UrlCellProps) {
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

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="url"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="https://..."
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
      className="dt-cell-url"
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
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
          }}
        >
          {value}
        </a>
      ) : (
        <span style={{ color: '#999' }}>Add URL...</span>
      )}
    </div>
  );
}
