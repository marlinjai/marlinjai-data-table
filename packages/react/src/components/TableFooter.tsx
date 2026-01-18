import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Column, Row, CellValue, FooterCalculationType, FooterConfig } from '@marlinjai/data-table-core';

export interface TableFooterProps {
  columns: Column[];
  rows: Row[];
  footerConfig?: FooterConfig;
  onFooterConfigChange?: (config: FooterConfig) => void;
  columnWidths?: Map<string, number>;
  showSelectionColumn?: boolean;
  showDeleteColumn?: boolean;
  showAddPropertyColumn?: boolean;
}

const CALCULATION_OPTIONS: { value: FooterCalculationType; label: string; types: string[] }[] = [
  { value: 'none', label: 'None', types: ['all'] },
  { value: 'count', label: 'Count all', types: ['all'] },
  { value: 'count_values', label: 'Count values', types: ['all'] },
  { value: 'count_unique', label: 'Count unique', types: ['all'] },
  { value: 'count_empty', label: 'Count empty', types: ['all'] },
  { value: 'count_not_empty', label: 'Count not empty', types: ['all'] },
  { value: 'percent_empty', label: 'Percent empty', types: ['all'] },
  { value: 'percent_not_empty', label: 'Percent not empty', types: ['all'] },
  { value: 'sum', label: 'Sum', types: ['number'] },
  { value: 'average', label: 'Average', types: ['number'] },
  { value: 'median', label: 'Median', types: ['number'] },
  { value: 'min', label: 'Min', types: ['number'] },
  { value: 'max', label: 'Max', types: ['number'] },
  { value: 'range', label: 'Range', types: ['number'] },
  { value: 'earliest_date', label: 'Earliest date', types: ['date', 'created_time', 'last_edited_time'] },
  { value: 'latest_date', label: 'Latest date', types: ['date', 'created_time', 'last_edited_time'] },
  { value: 'date_range', label: 'Date range (days)', types: ['date', 'created_time', 'last_edited_time'] },
];

function getAvailableCalculations(columnType: string): { value: FooterCalculationType; label: string }[] {
  return CALCULATION_OPTIONS.filter(opt =>
    opt.types.includes('all') || opt.types.includes(columnType)
  );
}

function calculateFooterValue(
  rows: Row[],
  columnId: string,
  columnType: string,
  calculation: FooterCalculationType
): string {
  if (calculation === 'none') return '';

  const values = rows.map(row => row.cells[columnId]);
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const total = rows.length;

  switch (calculation) {
    case 'count':
      return total.toString();

    case 'count_values':
      return nonNullValues.length.toString();

    case 'count_unique': {
      const unique = new Set(nonNullValues.map(v => JSON.stringify(v)));
      return unique.size.toString();
    }

    case 'count_empty':
      return (total - nonNullValues.length).toString();

    case 'count_not_empty':
      return nonNullValues.length.toString();

    case 'percent_empty': {
      if (total === 0) return '0%';
      const percent = ((total - nonNullValues.length) / total * 100).toFixed(1);
      return `${percent}%`;
    }

    case 'percent_not_empty': {
      if (total === 0) return '0%';
      const percent = (nonNullValues.length / total * 100).toFixed(1);
      return `${percent}%`;
    }

    case 'sum': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      const sum = numbers.reduce((acc, val) => acc + val, 0);
      return formatNumber(sum);
    }

    case 'average': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      const avg = numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
      return formatNumber(avg);
    }

    case 'median': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
      return formatNumber(median);
    }

    case 'min': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      return formatNumber(Math.min(...numbers));
    }

    case 'max': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      return formatNumber(Math.max(...numbers));
    }

    case 'range': {
      const numbers = nonNullValues.filter(v => typeof v === 'number') as number[];
      if (numbers.length === 0) return '-';
      const range = Math.max(...numbers) - Math.min(...numbers);
      return formatNumber(range);
    }

    case 'earliest_date': {
      const dates = nonNullValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length === 0) return '-';
      const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
      return formatDate(earliest);
    }

    case 'latest_date': {
      const dates = nonNullValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length === 0) return '-';
      const latest = new Date(Math.max(...dates.map(d => d.getTime())));
      return formatDate(latest);
    }

    case 'date_range': {
      const dates = nonNullValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length < 2) return '-';
      const timestamps = dates.map(d => d.getTime());
      const rangeDays = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24));
      return `${rangeDays} days`;
    }

    default:
      return '';
  }
}

function formatNumber(num: number): string {
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

interface FooterCellProps {
  column: Column;
  rows: Row[];
  calculation: FooterCalculationType;
  onCalculationChange: (calculation: FooterCalculationType) => void;
  width: number;
}

function FooterCell({ column, rows, calculation, onCalculationChange, width }: FooterCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const availableCalculations = useMemo(
    () => getAvailableCalculations(column.type),
    [column.type]
  );

  const calculatedValue = useMemo(
    () => calculateFooterValue(rows, column.id, column.type, calculation),
    [rows, column.id, column.type, calculation]
  );

  const currentOption = CALCULATION_OPTIONS.find(opt => opt.value === calculation);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <td
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        padding: '6px 8px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        position: 'relative',
      }}
    >
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          borderRadius: '4px',
          fontSize: '13px',
          color: calculation === 'none' ? '#9ca3af' : '#374151',
          fontWeight: calculation === 'none' ? 400 : 500,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {calculation === 'none' ? 'Calculate' : calculatedValue}
        </span>
        {calculation !== 'none' && (
          <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px', flexShrink: 0 }}>
            {currentOption?.label}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            minWidth: '160px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {availableCalculations.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onCalculationChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                background: calculation === opt.value ? '#eff6ff' : 'white',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#374151',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = calculation === opt.value ? '#eff6ff' : 'white')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </td>
  );
}

export function TableFooter({
  columns,
  rows,
  footerConfig,
  onFooterConfigChange,
  columnWidths,
  showSelectionColumn = false,
  showDeleteColumn = false,
  showAddPropertyColumn = false,
}: TableFooterProps) {
  const getColumnWidth = (columnId: string) => {
    return columnWidths?.get(columnId) ?? 200;
  };

  const handleCalculationChange = (columnId: string, calculation: FooterCalculationType) => {
    if (!onFooterConfigChange) return;

    const newCalculations = {
      ...footerConfig?.calculations,
      [columnId]: calculation,
    };

    onFooterConfigChange({ calculations: newCalculations });
  };

  return (
    <tfoot>
      <tr>
        {showSelectionColumn && (
          <td
            style={{
              width: '40px',
              minWidth: '40px',
              padding: '6px 8px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          />
        )}
        {columns.map((column) => (
          <FooterCell
            key={column.id}
            column={column}
            rows={rows}
            calculation={footerConfig?.calculations?.[column.id] ?? 'none'}
            onCalculationChange={(calc) => handleCalculationChange(column.id, calc)}
            width={getColumnWidth(column.id)}
          />
        ))}
        {showAddPropertyColumn && (
          <td
            style={{
              width: '140px',
              minWidth: '140px',
              padding: '6px 8px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          />
        )}
        {showDeleteColumn && (
          <td
            style={{
              width: '50px',
              minWidth: '50px',
              padding: '6px 8px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          />
        )}
      </tr>
    </tfoot>
  );
}
