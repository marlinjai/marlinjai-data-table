import { useMemo } from 'react';
import type { Row, Column, SelectOption, GroupConfig } from '@marlinjai/data-table-core';

export interface GroupedRow {
  value: string;
  label: string;
  rows: Row[];
  isCollapsed: boolean;
}

export interface UseGroupingResult {
  groups: GroupedRow[];
  isGrouped: boolean;
}

export interface UseGroupingOptions {
  rows: Row[];
  columns: Column[];
  groupConfig?: GroupConfig;
  selectOptions?: Map<string, SelectOption[]>;
}

/**
 * Hook to group rows by a specified column
 */
export function useGrouping({
  rows,
  columns,
  groupConfig,
  selectOptions = new Map(),
}: UseGroupingOptions): UseGroupingResult {
  return useMemo(() => {
    if (!groupConfig?.columnId) {
      return { groups: [], isGrouped: false };
    }

    const column = columns.find((c) => c.id === groupConfig.columnId);
    if (!column) {
      return { groups: [], isGrouped: false };
    }

    const collapsedSet = new Set(groupConfig.collapsedGroups ?? []);
    const columnSelectOptions = selectOptions.get(column.id) ?? [];

    // Create a map of option ID to label for select columns
    const optionLabelMap = new Map<string, string>();
    columnSelectOptions.forEach((opt) => {
      optionLabelMap.set(opt.id, opt.name);
    });

    // Group rows by their value in the specified column
    const groupMap = new Map<string, Row[]>();
    const emptyKey = '__empty__';

    rows.forEach((row) => {
      const cellValue = row.cells[column.id];
      const groupKeys = getGroupKeys(cellValue, column.type, optionLabelMap);

      groupKeys.forEach((key) => {
        const existingRows = groupMap.get(key) ?? [];
        existingRows.push(row);
        groupMap.set(key, existingRows);
      });
    });

    // Convert map to array of groups
    const groups: GroupedRow[] = [];

    groupMap.forEach((groupRows, key) => {
      const label = getGroupLabel(key, column.type, optionLabelMap, emptyKey);
      groups.push({
        value: key,
        label,
        rows: groupRows,
        isCollapsed: collapsedSet.has(key),
      });
    });

    // Sort groups
    const direction = groupConfig.direction ?? 'asc';
    groups.sort((a, b) => {
      // Empty group always at the end
      if (a.value === emptyKey) return 1;
      if (b.value === emptyKey) return -1;

      const comparison = a.label.localeCompare(b.label);
      return direction === 'asc' ? comparison : -comparison;
    });

    // Filter out empty groups if configured
    const filteredGroups = groupConfig.hideEmptyGroups
      ? groups.filter((g) => g.value !== emptyKey)
      : groups;

    return { groups: filteredGroups, isGrouped: true };
  }, [rows, columns, groupConfig, selectOptions]);
}

/**
 * Get the group key(s) for a cell value based on column type
 * For multi_select, a row can belong to multiple groups
 */
function getGroupKeys(
  value: unknown,
  columnType: string,
  optionLabelMap: Map<string, string>
): string[] {
  const emptyKey = '__empty__';

  if (value === null || value === undefined) {
    return [emptyKey];
  }

  switch (columnType) {
    case 'text':
    case 'url':
      return [String(value) || emptyKey];

    case 'number':
      return [String(value)];

    case 'boolean':
      return [value ? 'true' : 'false'];

    case 'date':
      if (value instanceof Date) {
        return [value.toISOString().split('T')[0]]; // Group by date only
      }
      if (typeof value === 'string') {
        // Try to parse as date
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return [date.toISOString().split('T')[0]];
        }
      }
      return [emptyKey];

    case 'select':
      // Value is option ID, use it as key
      if (typeof value === 'string' && value) {
        return [value];
      }
      return [emptyKey];

    case 'multi_select':
      // Value is array of option IDs
      if (Array.isArray(value) && value.length > 0) {
        return value.filter((v) => typeof v === 'string' && v);
      }
      return [emptyKey];

    default:
      return [String(value) || emptyKey];
  }
}

/**
 * Get display label for a group
 */
function getGroupLabel(
  key: string,
  columnType: string,
  optionLabelMap: Map<string, string>,
  emptyKey: string
): string {
  if (key === emptyKey) {
    return '(Empty)';
  }

  switch (columnType) {
    case 'boolean':
      return key === 'true' ? 'Yes' : 'No';

    case 'select':
    case 'multi_select':
      // Resolve option ID to label
      return optionLabelMap.get(key) ?? key;

    case 'date':
      // Format date nicely
      try {
        const date = new Date(key);
        return date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return key;
      }

    default:
      return key;
  }
}
