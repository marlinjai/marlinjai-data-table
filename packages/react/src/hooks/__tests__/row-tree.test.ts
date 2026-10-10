import { describe, expect, it } from 'vitest';
import type { Row } from '@marlinjai/data-table-core';
import { buildRowTree, descendantsOf, flattenRowTree } from '../rowTree';

const row = (id: string, parentRowId?: string) => ({ id, tableId: 't', cells: {}, parentRowId }) as unknown as Row;
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('buildRowTree (rows arranged by their parent)', () => {
  it('puts a child under its parent and keeps the order of the rows', () => {
    const tree = buildRowTree([row('a'), row('a2', 'a'), row('b'), row('a1', 'a')]);
    expect(ids(tree.roots)).toEqual(['a', 'b']);
    expect(ids(tree.childrenOf.get('a') ?? [])).toEqual(['a2', 'a1']);
  });

  it('keeps a row at the top level when its parent is not among the rows', () => {
    const tree = buildRowTree([row('orphan', 'gone'), row('b')]);
    expect(ids(tree.roots)).toEqual(['orphan', 'b']);
    expect(tree.childrenOf.size).toBe(0);
  });

  it('keeps the rows of a circle at the top level, each once', () => {
    const tree = buildRowTree([row('a', 'b'), row('b', 'a'), row('c', 'a'), row('self', 'self')]);
    expect(ids(tree.roots)).toEqual(['a', 'b', 'c', 'self']);
    expect(tree.childrenOf.size).toBe(0);
  });

  it('every row appears exactly once, whatever the links say', () => {
    const rows = [row('a'), row('a1', 'a'), row('a11', 'a1'), row('x', 'missing'), row('b')];
    const tree = buildRowTree(rows);
    expect(ids(flattenRowTree(tree.roots, tree.childrenOf).map((f) => f.row)).sort()).toEqual(ids(rows).sort());
  });
});

describe('flattenRowTree (the tree laid out for rendering)', () => {
  const tree = buildRowTree([row('a'), row('a1', 'a'), row('a11', 'a1'), row('b')]);

  it('lists parents before their children, with the depth of each', () => {
    expect(flattenRowTree(tree.roots, tree.childrenOf).map((f) => [f.row.id, f.depth, f.hasChildren])).toEqual([
      ['a', 0, true],
      ['a1', 1, true],
      ['a11', 2, false],
      ['b', 0, false],
    ]);
  });

  it('leaves out everything below a collapsed row, which still says it has children', () => {
    expect(flattenRowTree(tree.roots, tree.childrenOf, new Set(['a'])).map((f) => [f.row.id, f.hasChildren])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('lays out only the top-level rows it is given', () => {
    expect(ids(flattenRowTree([tree.roots[1]], tree.childrenOf).map((f) => f.row))).toEqual(['b']);
  });
});

describe('descendantsOf', () => {
  it('returns every row below a row, at any depth', () => {
    const tree = buildRowTree([row('a'), row('a1', 'a'), row('a11', 'a1'), row('b')]);
    expect(ids(descendantsOf('a', tree.childrenOf))).toEqual(['a1', 'a11']);
    expect(descendantsOf('b', tree.childrenOf)).toEqual([]);
  });
});
