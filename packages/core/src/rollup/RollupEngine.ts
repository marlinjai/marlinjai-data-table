/**
 * Rollup Engine for Notion-like data table
 *
 * Calculates aggregated values from related rows based on rollup configuration.
 * Supports various aggregation types including counting, numeric operations,
 * percentages, and display modes.
 */

import type {
  CellValue,
  Column,
  ColumnType,
  Row,
  RollupAggregation,
  RollupColumnConfig,
} from '../types';

/**
 * Result type for rollup calculations
 */
export type RollupResult = number | CellValue[] | null;

/**
 * RollupEngine calculates rollup values for a row based on its related rows
 * and the configured aggregation type.
 */
export class RollupEngine {
  /**
   * Calculate rollup value for a row
   *
   * @param config - The rollup column configuration
   * @param relatedRows - Array of related rows (already fetched via getRelatedRows)
   * @param targetColumn - The column to aggregate from related rows
   * @returns The aggregated value based on the aggregation type
   *
   * @example
   * ```typescript
   * const engine = new RollupEngine();
   * const result = engine.calculate(
   *   { relationColumnId: 'rel1', targetColumnId: 'price', aggregation: 'sum' },
   *   relatedRows,
   *   priceColumn
   * );
   * ```
   */
  calculate(
    config: RollupColumnConfig,
    relatedRows: Row[],
    targetColumn: Column
  ): RollupResult {
    const { aggregation } = config;
    const { targetColumnId } = config;

    // Extract values from related rows
    const values = this.extractValues(relatedRows, targetColumnId, targetColumn.type);

    switch (aggregation) {
      // Counting aggregations
      case 'count':
        return this.count(relatedRows);
      case 'countValues':
        return this.countValues(values);
      case 'countUnique':
        return this.countUnique(values);
      case 'countEmpty':
        return this.countEmpty(values);
      case 'countNotEmpty':
        return this.countValues(values);

      // Numeric aggregations
      case 'sum':
        return this.sum(values, targetColumn.type);
      case 'average':
        return this.average(values, targetColumn.type);
      case 'min':
        return this.min(values, targetColumn.type);
      case 'max':
        return this.max(values, targetColumn.type);

      // Percentage aggregations
      case 'percentEmpty':
        return this.percentEmpty(values);
      case 'percentNotEmpty':
        return this.percentNotEmpty(values);

      // Display aggregations
      case 'showOriginal':
        return this.showOriginal(values);
      case 'showUnique':
        return this.showUnique(values);

      default:
        // Exhaustive check for aggregation types
        const _exhaustiveCheck: never = aggregation;
        throw new Error(`Unknown aggregation type: ${_exhaustiveCheck}`);
    }
  }

  /**
   * Extract cell values from related rows for the target column
   */
  private extractValues(
    rows: Row[],
    targetColumnId: string,
    columnType: ColumnType
  ): CellValue[] {
    const values: CellValue[] = [];

    for (const row of rows) {
      const cellValue = row.cells[targetColumnId];

      // Handle multi_select arrays - flatten them (items are strings)
      if (columnType === 'multi_select' && Array.isArray(cellValue)) {
        for (const item of cellValue) {
          values.push(item as CellValue);
        }
      } else {
        values.push(cellValue);
      }
    }

    return values;
  }

  /**
   * Check if a value is considered empty
   */
  private isEmpty(value: CellValue): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * Convert a value to a number if possible
   */
  private toNumber(value: CellValue): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return null;
  }

  /**
   * Convert a value to a comparable value for min/max operations
   */
  private toComparable(value: CellValue, columnType: ColumnType): number | null {
    if (this.isEmpty(value)) {
      return null;
    }

    if (columnType === 'date') {
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.getTime();
      }
      return null;
    }

    return this.toNumber(value);
  }

  /**
   * Normalize a value for uniqueness comparison
   */
  private normalizeForComparison(value: CellValue): string {
    if (value === null || value === undefined) {
      return '__null__';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  // ==========================================================================
  // Counting Aggregations
  // ==========================================================================

  /**
   * Count total number of related rows
   */
  private count(rows: Row[]): number {
    return rows.length;
  }

  /**
   * Count non-empty values in the target column
   */
  private countValues(values: CellValue[]): number {
    return values.filter((v) => !this.isEmpty(v)).length;
  }

  /**
   * Count unique values in the target column
   */
  private countUnique(values: CellValue[]): number {
    const uniqueSet = new Set<string>();

    for (const value of values) {
      if (!this.isEmpty(value)) {
        uniqueSet.add(this.normalizeForComparison(value));
      }
    }

    return uniqueSet.size;
  }

  /**
   * Count empty/null values in the target column
   */
  private countEmpty(values: CellValue[]): number {
    return values.filter((v) => this.isEmpty(v)).length;
  }

  // ==========================================================================
  // Numeric Aggregations
  // ==========================================================================

  /**
   * Sum of numeric values
   */
  private sum(values: CellValue[], columnType: ColumnType): number {
    if (values.length === 0) {
      return 0;
    }

    let total = 0;
    for (const value of values) {
      const num = this.toNumber(value);
      if (num !== null) {
        total += num;
      }
    }

    return total;
  }

  /**
   * Average of numeric values
   */
  private average(values: CellValue[], columnType: ColumnType): number | null {
    if (values.length === 0) {
      return null;
    }

    const numericValues: number[] = [];
    for (const value of values) {
      const num = this.toNumber(value);
      if (num !== null) {
        numericValues.push(num);
      }
    }

    if (numericValues.length === 0) {
      return null;
    }

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    return sum / numericValues.length;
  }

  /**
   * Minimum value
   * For dates, returns the earliest date as timestamp
   * For numbers, returns the smallest number
   */
  private min(values: CellValue[], columnType: ColumnType): number | null {
    if (values.length === 0) {
      return null;
    }

    let minValue: number | null = null;

    for (const value of values) {
      const comparable = this.toComparable(value, columnType);
      if (comparable !== null) {
        if (minValue === null || comparable < minValue) {
          minValue = comparable;
        }
      }
    }

    return minValue;
  }

  /**
   * Maximum value
   * For dates, returns the latest date as timestamp
   * For numbers, returns the largest number
   */
  private max(values: CellValue[], columnType: ColumnType): number | null {
    if (values.length === 0) {
      return null;
    }

    let maxValue: number | null = null;

    for (const value of values) {
      const comparable = this.toComparable(value, columnType);
      if (comparable !== null) {
        if (maxValue === null || comparable > maxValue) {
          maxValue = comparable;
        }
      }
    }

    return maxValue;
  }

  // ==========================================================================
  // Percentage Aggregations
  // ==========================================================================

  /**
   * Percentage of empty values (0-100)
   */
  private percentEmpty(values: CellValue[]): number {
    if (values.length === 0) {
      return 0;
    }

    const emptyCount = this.countEmpty(values);
    return (emptyCount / values.length) * 100;
  }

  /**
   * Percentage of non-empty values (0-100)
   */
  private percentNotEmpty(values: CellValue[]): number {
    if (values.length === 0) {
      return 0;
    }

    const nonEmptyCount = this.countValues(values);
    return (nonEmptyCount / values.length) * 100;
  }

  // ==========================================================================
  // Display Aggregations
  // ==========================================================================

  /**
   * Return array of all values (preserving order and duplicates)
   */
  private showOriginal(values: CellValue[]): CellValue[] {
    return values.filter((v) => !this.isEmpty(v));
  }

  /**
   * Return array of unique values (preserving first occurrence order)
   */
  private showUnique(values: CellValue[]): CellValue[] {
    const seen = new Set<string>();
    const unique: CellValue[] = [];

    for (const value of values) {
      if (this.isEmpty(value)) {
        continue;
      }

      const normalized = this.normalizeForComparison(value);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(value);
      }
    }

    return unique;
  }
}
