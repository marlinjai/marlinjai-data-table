import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Column, Row, FooterCalculationType, FooterConfig } from '@marlinjai/data-table-core';

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

// Define which calculations are available for each column type
const COLUMN_TYPE_CALCULATIONS: Record<string, FooterCalculationType[]> = {
  // Numeric columns get all numeric calculations
  number: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
    'sum', 'average', 'median', 'min', 'max', 'range',
  ],

  // Text columns get counting calculations only
  text: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // Date columns get date-specific calculations
  date: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
    'earliest_date', 'latest_date', 'date_range',
  ],

  // Timestamp columns (auto-populated, so never empty)
  created_time: [
    'none', 'count', 'count_unique',
    'earliest_date', 'latest_date', 'date_range',
  ],
  last_edited_time: [
    'none', 'count', 'count_unique',
    'earliest_date', 'latest_date', 'date_range',
  ],

  // Boolean columns - count checked/unchecked
  boolean: [
    'none', 'count', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
    'checked', 'unchecked', 'percent_checked', 'percent_unchecked',
  ],

  // Select columns
  select: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // Multi-select columns
  multi_select: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // URL columns
  url: [
    'none', 'count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // File columns - count files
  file: [
    'none', 'count', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // Formula columns - depends on result type, but basic counting works
  formula: [
    'none', 'count', 'count_values', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // Relation columns - count linked items
  relation: [
    'none', 'count', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],

  // Rollup columns - basic counting only
  rollup: [
    'none', 'count', 'count_values', 'count_empty', 'count_not_empty',
    'percent_empty', 'percent_not_empty',
  ],
};

// Labels for all calculation types
const CALCULATION_LABELS: Record<FooterCalculationType, string> = {
  none: 'None',
  count: 'Count all',
  count_values: 'Count values',
  count_unique: 'Count unique',
  count_empty: 'Count empty',
  count_not_empty: 'Count not empty',
  percent_empty: 'Percent empty',
  percent_not_empty: 'Percent not empty',
  sum: 'Sum',
  average: 'Average',
  median: 'Median',
  min: 'Min',
  max: 'Max',
  range: 'Range',
  earliest_date: 'Earliest',
  latest_date: 'Latest',
  date_range: 'Date range',
  checked: 'Checked',
  unchecked: 'Unchecked',
  percent_checked: 'Percent checked',
  percent_unchecked: 'Percent unchecked',
};

function getAvailableCalculations(columnType: string): { value: FooterCalculationType; label: string }[] {
  const calculations = COLUMN_TYPE_CALCULATIONS[columnType] || COLUMN_TYPE_CALCULATIONS.text;
  return calculations.map(calc => ({
    value: calc,
    label: CALCULATION_LABELS[calc] || calc,
  }));
}

function calculateFooterValue(
  rows: Row[],
  columnId: string,
  columnType: string,
  calculation: FooterCalculationType
): string {
  if (calculation === 'none') return '';

  const values = rows.map(row => row.cells[columnId]);
  const total = rows.length;

  // Handle "empty" differently based on column type
  const isValueEmpty = (v: unknown): boolean => {
    if (v === null || v === undefined) return true;
    if (v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  };

  const nonEmptyValues = values.filter(v => !isValueEmpty(v));

  switch (calculation) {
    case 'count':
      return total.toString();

    case 'count_values':
      return nonEmptyValues.length.toString();

    case 'count_unique': {
      const unique = new Set(nonEmptyValues.map(v => JSON.stringify(v)));
      return unique.size.toString();
    }

    case 'count_empty':
      return (total - nonEmptyValues.length).toString();

    case 'count_not_empty':
      return nonEmptyValues.length.toString();

    case 'percent_empty': {
      if (total === 0) return '0%';
      const percent = ((total - nonEmptyValues.length) / total * 100).toFixed(1);
      return `${percent}%`;
    }

    case 'percent_not_empty': {
      if (total === 0) return '0%';
      const percent = (nonEmptyValues.length / total * 100).toFixed(1);
      return `${percent}%`;
    }

    // Numeric calculations - only for number columns
    case 'sum': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) return '-';
      const sum = numbers.reduce((acc, val) => acc + val, 0);
      return formatNumber(sum);
    }

    case 'average': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) return '-';
      const avg = numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
      return formatNumber(avg);
    }

    case 'median': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) return '-';
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
      return formatNumber(median);
    }

    case 'min': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) return '-';
      return formatNumber(Math.min(...numbers));
    }

    case 'max': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) return '-';
      return formatNumber(Math.max(...numbers));
    }

    case 'range': {
      if (columnType !== 'number') return '-';
      const numbers = nonEmptyValues.filter((v): v is number => typeof v === 'number');
      if (numbers.length < 2) return '-';
      const rangeVal = Math.max(...numbers) - Math.min(...numbers);
      return formatNumber(rangeVal);
    }

    // Date calculations
    case 'earliest_date': {
      const dates = nonEmptyValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length === 0) return '-';
      const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
      return formatDate(earliest);
    }

    case 'latest_date': {
      const dates = nonEmptyValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length === 0) return '-';
      const latest = new Date(Math.max(...dates.map(d => d.getTime())));
      return formatDate(latest);
    }

    case 'date_range': {
      const dates = nonEmptyValues
        .map(v => v instanceof Date ? v : new Date(v as string))
        .filter(d => !isNaN(d.getTime()));
      if (dates.length < 2) return '-';
      const timestamps = dates.map(d => d.getTime());
      const rangeDays = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24));
      return `${rangeDays} days`;
    }

    // Boolean calculations
    case 'checked': {
      if (columnType !== 'boolean') return '-';
      const checkedCount = values.filter(v => v === true).length;
      return checkedCount.toString();
    }

    case 'unchecked': {
      if (columnType !== 'boolean') return '-';
      const uncheckedCount = values.filter(v => v === false || v === null || v === undefined).length;
      return uncheckedCount.toString();
    }

    case 'percent_checked': {
      if (columnType !== 'boolean') return '-';
      if (total === 0) return '0%';
      const checkedCount = values.filter(v => v === true).length;
      const percent = (checkedCount / total * 100).toFixed(1);
      return `${percent}%`;
    }

    case 'percent_unchecked': {
      if (columnType !== 'boolean') return '-';
      if (total === 0) return '0%';
      const uncheckedCount = values.filter(v => v !== true).length;
      const percent = (uncheckedCount / total * 100).toFixed(1);
      return `${percent}%`;
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableCalculations = useMemo(
    () => getAvailableCalculations(column.type),
    [column.type]
  );

  const calculatedValue = useMemo(
    () => calculateFooterValue(rows, column.id, column.type, calculation),
    [rows, column.id, column.type, calculation]
  );

  const currentOption = availableCalculations.find(opt => opt.value === calculation);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown above if near bottom of viewport
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 300; // max-height

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        // Position above
        setDropdownPosition({
          top: rect.top + window.scrollY - dropdownHeight,
          left: rect.left + window.scrollX,
        });
      } else {
        // Position below
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
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
        borderTop: '1px solid var(--dt-border-color)',
        backgroundColor: 'var(--dt-bg-secondary)',
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
          color: calculation === 'none' ? 'var(--dt-text-muted)' : 'var(--dt-text-primary)',
          fontWeight: calculation === 'none' ? 400 : 500,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-border-color)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {calculation === 'none' ? 'Calculate' : calculatedValue}
        </span>
        {calculation !== 'none' && (
          <span style={{ fontSize: '11px', color: 'var(--dt-text-muted)', marginLeft: '4px', flexShrink: 0 }}>
            {currentOption?.label}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 1000,
            backgroundColor: 'var(--dt-bg-primary)',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '6px',
            boxShadow: 'var(--dt-shadow-md)',
            minWidth: '180px',
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
                background: calculation === opt.value ? 'var(--dt-bg-selected)' : 'var(--dt-bg-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--dt-text-primary)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = calculation === opt.value ? 'var(--dt-bg-selected)' : 'var(--dt-bg-primary)')}
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
              borderTop: '1px solid var(--dt-border-color)',
              backgroundColor: 'var(--dt-bg-secondary)',
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
              borderTop: '1px solid var(--dt-border-color)',
              backgroundColor: 'var(--dt-bg-secondary)',
            }}
          />
        )}
        {showDeleteColumn && (
          <td
            style={{
              width: '50px',
              minWidth: '50px',
              padding: '6px 8px',
              borderTop: '1px solid var(--dt-border-color)',
              backgroundColor: 'var(--dt-bg-secondary)',
            }}
          />
        )}
      </tr>
    </tfoot>
  );
}
