import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Row, Column, CellValue } from '@marlinjai/data-table-core';

export interface SearchBarProps {
  rows: Row[];
  columns: Column[];
  onSearchResults: (filteredRows: Row[], searchTerm: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

function cellValueToString(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'object' && v !== null) {
        // Handle RelationValue and FileReference
        return JSON.stringify(v);
      }
      return String(v);
    }).join(' ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function searchRows(rows: Row[], columns: Column[], searchTerm: string): Row[] {
  if (!searchTerm.trim()) return rows;

  const term = searchTerm.toLowerCase().trim();
  const searchableColumnIds = columns
    .filter((col) => {
      // Exclude computed columns that don't have searchable content
      return !['formula', 'rollup'].includes(col.type);
    })
    .map((col) => col.id);

  return rows.filter((row) => {
    // Search in all searchable cell values
    for (const columnId of searchableColumnIds) {
      const value = row.cells[columnId];
      const stringValue = cellValueToString(value).toLowerCase();
      if (stringValue.includes(term)) {
        return true;
      }
    }
    return false;
  });
}

export function SearchBar({
  rows,
  columns,
  onSearchResults,
  placeholder = 'Search...',
  debounceMs = 200,
  className,
  style,
}: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (term: string) => {
      const results = searchRows(rows, columns, term);
      onSearchResults(results, term);
    },
    [rows, columns, onSearchResults]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);

      // Debounce the search
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        handleSearch(value);
      }, debounceMs);
    },
    [handleSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setSearchTerm('');
    handleSearch('');
    inputRef.current?.focus();
  }, [handleSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + F to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const resultCount = useMemo(() => {
    if (!searchTerm.trim()) return null;
    return searchRows(rows, columns, searchTerm).length;
  }, [rows, columns, searchTerm]);

  return (
    <div
      className={`dt-search-bar ${className ?? ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: isFocused ? 'white' : '#f9fafb',
        border: `1px solid ${isFocused ? '#2563eb' : '#e5e7eb'}`,
        borderRadius: '6px',
        transition: 'all 0.15s ease-in-out',
        ...style,
      }}
    >
      {/* Search icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isFocused ? '#2563eb' : '#9ca3af'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          fontSize: '14px',
          color: '#374151',
        }}
      />

      {/* Result count */}
      {searchTerm && resultCount !== null && (
        <span
          style={{
            fontSize: '12px',
            color: resultCount > 0 ? '#6b7280' : '#ef4444',
            whiteSpace: 'nowrap',
          }}
        >
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      )}

      {/* Clear button */}
      {searchTerm && (
        <button
          onClick={handleClear}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            border: 'none',
            background: '#e5e7eb',
            borderRadius: '50%',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d1d5db')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
          title="Clear search (Esc)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Keyboard shortcut hint */}
      {!searchTerm && !isFocused && (
        <span
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            backgroundColor: '#f3f4f6',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        >
          {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+F
        </span>
      )}
    </div>
  );
}

// Hook for using search functionality without the UI component
export function useTableSearch(rows: Row[], columns: Column[]) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    return searchRows(rows, columns, searchTerm);
  }, [rows, columns, searchTerm]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filteredRows,
    clearSearch,
    resultCount: searchTerm ? filteredRows.length : null,
    isSearching: !!searchTerm.trim(),
  };
}
