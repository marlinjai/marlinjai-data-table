/**
 * Batch loading types for junction table data (files, relations, multi-select).
 *
 * Adapters implement the actual SQL queries — this module provides the
 * type contracts and merge utilities for batch-loading junction data into rows.
 */

import type { Row, FileReference, RelationValue } from '@marlinjai/data-table-core';

/** Maps rowId -> Map<columnId, values> */
export type BatchFileResult = Map<string, Map<string, FileReference[]>>;
export type BatchRelationResult = Map<string, Map<string, RelationValue[]>>;
export type BatchSelectResult = Map<string, Map<string, string[]>>;

/**
 * Merge batch-loaded file references into rows.
 */
export function mergeFiles(rows: Row[], files: BatchFileResult): void {
  for (const row of rows) {
    const rowFiles = files.get(row.id);
    if (rowFiles) {
      for (const [columnId, refs] of rowFiles) {
        row.cells[columnId] = refs;
      }
    }
  }
}

/**
 * Merge batch-loaded relations into rows.
 */
export function mergeRelations(rows: Row[], relations: BatchRelationResult): void {
  for (const row of rows) {
    const rowRelations = relations.get(row.id);
    if (rowRelations) {
      for (const [columnId, rels] of rowRelations) {
        row.cells[columnId] = rels;
      }
    }
  }
}

/**
 * Merge batch-loaded multi-select values into rows.
 */
export function mergeSelections(rows: Row[], selections: BatchSelectResult): void {
  for (const row of rows) {
    const rowSelections = selections.get(row.id);
    if (rowSelections) {
      for (const [columnId, optionIds] of rowSelections) {
        row.cells[columnId] = optionIds;
      }
    }
  }
}

/**
 * Build a batch result map from flat query results.
 * Generic utility to group results by rowId and columnId.
 */
export function buildBatchMap<T>(
  results: Array<{ rowId: string; columnId: string; value: T }>,
): Map<string, Map<string, T[]>> {
  const map = new Map<string, Map<string, T[]>>();

  for (const { rowId, columnId, value } of results) {
    let rowMap = map.get(rowId);
    if (!rowMap) {
      rowMap = new Map();
      map.set(rowId, rowMap);
    }

    let values = rowMap.get(columnId);
    if (!values) {
      values = [];
      rowMap.set(columnId, values);
    }

    values.push(value);
  }

  return map;
}
