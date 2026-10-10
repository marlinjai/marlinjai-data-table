import type { Row } from '@marlinjai/data-table-core';

/** Rows arranged by their `parentRowId`: the rows at the top level and each parent's children. */
export interface RowTree {
  roots: Row[];
  childrenOf: Map<string, Row[]>;
}

/** One row of a tree laid out for rendering. */
export interface FlatRow {
  row: Row;
  depth: number;
  hasChildren: boolean;
}

/**
 * Arrange rows into a tree. The order of `rows` is kept, at the top level and
 * among the children of one parent.
 *
 * A row stays at the top level when it has no parent, when its parent is not in
 * `rows` (filtered out, not matched by a search, deleted), or when its chain of
 * parents runs in a circle. A row therefore appears exactly once, and never
 * disappears because the row above it is missing.
 */
export function buildRowTree(rows: Row[]): RowTree {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots: Row[] = [];
  const childrenOf = new Map<string, Row[]>();

  const reachesTopLevel = (row: Row): boolean => {
    const seen = new Set<string>([row.id]);
    let current: Row | undefined = row;
    while (current?.parentRowId) {
      const parent = byId.get(current.parentRowId);
      // The chain ends at a missing parent: the row below it is a top-level row, so this one hangs off it.
      if (!parent) return true;
      if (seen.has(parent.id)) return false;
      seen.add(parent.id);
      current = parent;
    }
    return true;
  };

  for (const row of rows) {
    const parent = row.parentRowId ? byId.get(row.parentRowId) : undefined;
    if (!parent || !reachesTopLevel(row)) {
      roots.push(row);
      continue;
    }
    const siblings = childrenOf.get(parent.id);
    if (siblings) siblings.push(row);
    else childrenOf.set(parent.id, [row]);
  }

  return { roots, childrenOf };
}

/**
 * Lay the given top-level rows out with everything below them, parents first.
 * The children of a row in `collapsed` are left out.
 */
export function flattenRowTree(
  roots: Row[],
  childrenOf: Map<string, Row[]>,
  collapsed: ReadonlySet<string> = new Set()
): FlatRow[] {
  const out: FlatRow[] = [];
  const visit = (row: Row, depth: number) => {
    const children = childrenOf.get(row.id) ?? [];
    out.push({ row, depth, hasChildren: children.length > 0 });
    if (collapsed.has(row.id)) return;
    for (const child of children) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  return out;
}

/** Every row below the given one, at any depth. */
export function descendantsOf(rowId: string, childrenOf: Map<string, Row[]>): Row[] {
  const out: Row[] = [];
  const visit = (id: string) => {
    for (const child of childrenOf.get(id) ?? []) {
      out.push(child);
      visit(child.id);
    }
  };
  visit(rowId);
  return out;
}
