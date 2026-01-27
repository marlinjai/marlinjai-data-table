import { useState, useCallback } from 'react';
import type { Column, QueryFilter, FilterOperator, SelectOption } from '@marlinjai/data-table-core';

export interface FilterBarProps {
  columns: Column[];
  filters: QueryFilter[];
  selectOptions?: Map<string, SelectOption[]>;
  onFiltersChange: (filters: QueryFilter[]) => void;
}

const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'notEquals', label: '≠' },
    { value: 'greaterThan', label: '>' },
    { value: 'lessThan', label: '<' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  date: [
    { value: 'equals', label: 'is' },
    { value: 'greaterThan', label: 'after' },
    { value: 'lessThan', label: 'before' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  boolean: [
    { value: 'equals', label: 'is' },
  ],
  select: [
    { value: 'equals', label: 'is' },
    { value: 'notEquals', label: 'is not' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  multi_select: [
    { value: 'contains', label: 'contains' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  url: [
    { value: 'contains', label: 'contains' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
};

function getOperatorsForColumn(column: Column) {
  return OPERATORS_BY_TYPE[column.type] ?? OPERATORS_BY_TYPE.text;
}

export function FilterBar({
  columns,
  filters,
  selectOptions = new Map(),
  onFiltersChange,
}: FilterBarProps) {
  const [isAddingFilter, setIsAddingFilter] = useState(false);

  const handleAddFilter = useCallback(
    (columnId: string) => {
      const column = columns.find((c) => c.id === columnId);
      if (!column) return;

      const operators = getOperatorsForColumn(column);
      const newFilter: QueryFilter = {
        columnId,
        operator: operators[0].value,
        value: null,
      };

      onFiltersChange([...filters, newFilter]);
      setIsAddingFilter(false);
    },
    [columns, filters, onFiltersChange]
  );

  const handleUpdateFilter = useCallback(
    (index: number, updates: Partial<QueryFilter>) => {
      const newFilters = [...filters];
      newFilters[index] = { ...newFilters[index], ...updates };
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      const newFilters = filters.filter((_, i) => i !== index);
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  // Get columns that can be filtered (exclude formula, rollup for now)
  const filterableColumns = columns.filter(
    (c) => !['formula', 'rollup', 'relation', 'file'].includes(c.type)
  );

  return (
    <div
      className="dt-filter-bar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'var(--dt-bg-secondary)',
        borderBottom: '1px solid var(--dt-border-color)',
      }}
    >
      {filters.map((filter, index) => {
        const column = columns.find((c) => c.id === filter.columnId);
        if (!column) return null;

        const operators = getOperatorsForColumn(column);
        const needsValue = !['isEmpty', 'isNotEmpty'].includes(filter.operator);

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'var(--dt-bg-primary)',
              border: '1px solid var(--dt-border-color)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: 'var(--dt-text-secondary)' }}>{column.name}</span>

            <select
              value={filter.operator}
              onChange={(e) =>
                handleUpdateFilter(index, { operator: e.target.value as FilterOperator })
              }
              style={{
                border: 'none',
                background: 'none',
                fontSize: '13px',
                color: 'var(--dt-text-primary)',
                cursor: 'pointer',
              }}
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {needsValue && (
              <FilterValueInput
                column={column}
                value={filter.value}
                onChange={(value) => handleUpdateFilter(index, { value })}
                selectOptions={selectOptions.get(column.id)}
              />
            )}

            <button
              onClick={() => handleRemoveFilter(index)}
              style={{
                padding: '2px 4px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--dt-text-muted)',
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}

      {isAddingFilter ? (
        <select
          autoFocus
          onChange={(e) => {
            if (e.target.value) {
              handleAddFilter(e.target.value);
            }
          }}
          onBlur={() => setIsAddingFilter(false)}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '4px',
            fontSize: '13px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        >
          <option value="">Select column...</option>
          {filterableColumns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setIsAddingFilter(true)}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--dt-bg-primary)',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--dt-text-secondary)',
          }}
        >
          + Add filter
        </button>
      )}

      {filters.length > 0 && (
        <button
          onClick={handleClearAll}
          style={{
            padding: '4px 8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--dt-text-muted)',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

interface FilterValueInputProps {
  column: Column;
  value: any;
  onChange: (value: any) => void;
  selectOptions?: SelectOption[];
}

function FilterValueInput({ column, value, onChange, selectOptions = [] }: FilterValueInputProps) {
  switch (column.type) {
    case 'boolean':
      return (
        <select
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={(e) => onChange(e.target.value === 'true')}
          style={{
            padding: '2px 4px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '2px',
            fontSize: '13px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );

    case 'select':
    case 'multi_select':
      return (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            padding: '2px 4px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '2px',
            fontSize: '13px',
            maxWidth: '120px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        >
          <option value="">Select...</option>
          {selectOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          placeholder="Value"
          style={{
            padding: '2px 4px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '2px',
            fontSize: '13px',
            width: '80px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            padding: '2px 4px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '2px',
            fontSize: '13px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Value"
          style={{
            padding: '2px 4px',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '2px',
            fontSize: '13px',
            width: '100px',
            backgroundColor: 'var(--dt-bg-primary)',
            color: 'var(--dt-text-primary)',
          }}
        />
      );
  }
}
