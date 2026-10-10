import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { CellValue, Column, Row, SelectOption } from '@marlinjai/data-table-core';
import { TableView } from '../TableView';

/**
 * A container ("Trip") in the software group with two receipts underneath, one
 * of them categorised as a meal. Next to it a plain receipt per category, and a
 * receipt whose parent is not in the list.
 */
function fixture() {
  const columns = [
    { id: 'name', tableId: 't', name: 'Name', type: 'text', position: 0, width: 200, isPrimary: true },
    { id: 'cat', tableId: 't', name: 'Category', type: 'select', position: 1, width: 200 },
    { id: 'gross', tableId: 't', name: 'Gross', type: 'number', position: 2, width: 120 },
  ] as unknown as Column[];
  const rows = [
    { id: 'trip', tableId: 't', cells: { name: 'Trip', cat: 'software', gross: null } },
    { id: 'hotel', tableId: 't', parentRowId: 'trip', cells: { name: 'Hotel', cat: 'software', gross: 100 } },
    { id: 'dinner', tableId: 't', parentRowId: 'trip', cells: { name: 'Dinner', cat: 'meals', gross: 40 } },
    { id: 'licence', tableId: 't', cells: { name: 'Licence', cat: 'software', gross: 10 } },
    { id: 'lunch', tableId: 't', cells: { name: 'Lunch', cat: 'meals', gross: 5 } },
    { id: 'orphan', tableId: 't', parentRowId: 'gone', cells: { name: 'Orphan', cat: 'meals', gross: 7 } },
  ] as unknown as Row[];
  const selectOptions = new Map<string, SelectOption[]>([
    ['cat', [{ id: 'software', name: 'Software' }, { id: 'meals', name: 'Meals' }] as unknown as SelectOption[]],
  ]);
  return {
    columns,
    rows,
    selectOptions,
    groupConfig: { columnId: 'cat', direction: 'asc' as const },
    subItemsConfig: { enabled: true },
  };
}

function dataTransfer() {
  const data = new Map<string, string>();
  return { effectAllowed: '', dropEffect: '', setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', types: [] as string[] };
}

const section = (container: HTMLElement, key: string) => container.querySelector(`[data-group-key="${key}"]`) as HTMLElement;
const rowEl = (container: HTMLElement, id: string) => container.querySelector(`tr[data-row-id="${id}"]`) as HTMLElement;
const rowIdsIn = (el: HTMLElement) => [...el.querySelectorAll('tr[data-row-id]')].map((tr) => tr.getAttribute('data-row-id'));
const toggle = (container: HTMLElement, id: string) => rowEl(container, id).querySelector('button[aria-expanded]') as HTMLElement;
/** The number next to a group's label. */
const headerCount = (container: HTMLElement, key: string) => section(container, key).querySelector('.dt-group-header')?.lastElementChild?.textContent;

describe('a grouped table nests sub-items', () => {
  it('draws a child under its parent, in the parent’s group, and nowhere else', () => {
    const { container } = render(<TableView {...fixture()} />);
    // "Dinner" is a meal by its own cell, but it belongs to "Trip", which sits in the software group.
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'hotel', 'dinner', 'licence']);
    expect(rowIdsIn(section(container, 'meals'))).toEqual(['lunch', 'orphan']);
    expect(container.querySelectorAll('tr[data-row-id="dinner"]')).toHaveLength(1);
    expect(rowEl(container, 'trip').getAttribute('data-row-depth')).toBe('0');
    expect(rowEl(container, 'dinner').getAttribute('data-row-depth')).toBe('1');
  });

  it('a row whose parent is not in the list is a top-level row of its own group', () => {
    const { container } = render(<TableView {...fixture()} />);
    expect(rowEl(container, 'orphan').getAttribute('data-row-depth')).toBe('0');
    expect(section(container, 'meals').contains(rowEl(container, 'orphan'))).toBe(true);
  });

  it('a child whose parent is filtered out of the rows moves to the top level of its own group', () => {
    const f = fixture();
    const { container } = render(<TableView {...f} rows={f.rows.filter((r) => r.id !== 'trip')} />);
    expect(rowIdsIn(section(container, 'software'))).toEqual(['hotel', 'licence']);
    expect(rowIdsIn(section(container, 'meals'))).toEqual(['dinner', 'lunch', 'orphan']);
  });

  it('a parent folds and unfolds, and says so', () => {
    const onCollapseRow = vi.fn();
    const onExpandRow = vi.fn();
    const { container } = render(<TableView {...fixture()} onCollapseRow={onCollapseRow} onExpandRow={onExpandRow} />);
    expect(toggle(container, 'trip').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle(container, 'trip'));
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'licence']);
    expect(toggle(container, 'trip').getAttribute('aria-expanded')).toBe('false');
    expect(onCollapseRow).toHaveBeenCalledWith('trip');

    fireEvent.click(toggle(container, 'trip'));
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'hotel', 'dinner', 'licence']);
    expect(onExpandRow).toHaveBeenCalledWith('trip');
  });

  it('starts with the parents folded that the configuration names, also when the list is built anew on every render', () => {
    const f = fixture();
    const { container, rerender } = render(<TableView {...f} subItemsConfig={{ enabled: true, collapsedParents: ['trip'] }} />);
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'licence']);
    fireEvent.click(toggle(container, 'trip'));
    rerender(<TableView {...f} subItemsConfig={{ enabled: true, collapsedParents: ['trip'] }} />);
    // The same content in a new array must not fold the row again.
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'hotel', 'dinner', 'licence']);
  });

  it('a row without children has no fold button', () => {
    const { container } = render(<TableView {...fixture()} />);
    expect(toggle(container, 'licence')).toBeNull();
    expect(toggle(container, 'hotel')).toBeNull();
  });

  it('without sub-items the rows stay flat, each in the group of its own cell', () => {
    const f = fixture();
    const { container } = render(<TableView {...f} subItemsConfig={undefined} />);
    expect(rowIdsIn(section(container, 'software'))).toEqual(['trip', 'hotel', 'licence']);
    expect(rowIdsIn(section(container, 'meals'))).toEqual(['dinner', 'lunch', 'orphan']);
    expect(rowEl(container, 'trip').getAttribute('data-row-depth')).toBeNull();
  });
});

describe('group counts with sub-items', () => {
  it('count every row once, in the group it is drawn in, folded or not', () => {
    const { container } = render(<TableView {...fixture()} />);
    expect(headerCount(container, 'software')).toBe('4');
    expect(headerCount(container, 'meals')).toBe('2');
    fireEvent.click(toggle(container, 'trip'));
    expect(headerCount(container, 'software')).toBe('4');
  });

  it('leave out the rows the consumer says do not count', () => {
    const { container } = render(<TableView {...fixture()} isCountedRow={(row) => row.id !== 'trip'} />);
    expect(headerCount(container, 'software')).toBe('3');
    expect(headerCount(container, 'meals')).toBe('2');
  });

  it('the footer of an ungrouped table counts and sums only the rows that count', () => {
    const f = fixture();
    const { container } = render(
      <TableView
        columns={f.columns}
        rows={f.rows}
        subItemsConfig={f.subItemsConfig}
        isCountedRow={(row) => row.id !== 'trip'}
        footerConfig={{ calculations: { name: 'count', gross: 'sum' } }}
      />,
    );
    const footer = container.querySelector('tfoot') as HTMLElement;
    // Five receipts (the container is left out) and their amounts: 100 + 40 + 10 + 5 + 7.
    expect(footer.textContent).toContain('5Count');
    expect(footer.textContent).toContain('162Sum');
  });
});

describe('a parent shows a value computed from its children', () => {
  const sum = (row: Row, children: Row[], column: Column): CellValue | undefined =>
    row.id === 'trip' && column.id === 'gross' ? children.reduce((total, c) => total + Number(c.cells.gross ?? 0), 0) : undefined;

  it('in the column the consumer names, read-only, and the rows are left as they are', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const before = JSON.stringify(f.rows);
    const { container } = render(<TableView {...f} getSubItemSummary={sum} onCellChange={onCellChange} />);
    const cell = rowEl(container, 'trip').querySelectorAll('td')[2];
    expect(cell.textContent).toContain('140');
    fireEvent.click(cell.querySelector('.dt-cell-number') ?? cell);
    expect(cell.querySelector('input')).toBeNull();
    expect(onCellChange).not.toHaveBeenCalled();
    expect(JSON.stringify(f.rows)).toBe(before);
  });

  it('keeps showing the sum of all children while the parent is folded', () => {
    const { container } = render(<TableView {...fixture()} getSubItemSummary={sum} />);
    fireEvent.click(toggle(container, 'trip'));
    expect(rowEl(container, 'trip').querySelectorAll('td')[2].textContent).toContain('140');
  });

  it('other rows and other columns show their own cells', () => {
    const { container } = render(<TableView {...fixture()} getSubItemSummary={sum} />);
    expect(rowEl(container, 'hotel').querySelectorAll('td')[2].textContent).toContain('100');
    expect(rowEl(container, 'trip').querySelectorAll('td')[0].textContent).toContain('Trip');
  });
});

describe('dragging between groups with sub-items', () => {
  function drag(container: HTMLElement, rowId: string, targetKey: string) {
    const dt = dataTransfer();
    const row = rowEl(container, rowId);
    fireEvent.mouseDown(row.querySelector('.dt-row-grip') as HTMLElement);
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.dragOver(section(container, targetKey), { dataTransfer: dt });
    return { drop: () => fireEvent.drop(section(container, targetKey), { dataTransfer: dt }) };
  }

  it('moving a parent writes the parent only, and its children are on the move with it', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} />);
    const d = drag(container, 'trip', 'meals');
    expect(rowEl(container, 'trip').className).toContain('dt-row-dragging');
    expect(rowEl(container, 'hotel').className).toContain('dt-row-dragging');
    expect(rowEl(container, 'dinner').className).toContain('dt-row-dragging');
    expect(rowEl(container, 'licence').className ?? '').not.toContain('dt-row-dragging');
    d.drop();
    expect(onCellChange.mock.calls).toEqual([['trip', 'cat', 'meals']]);
  });

  it('once the parent is in the other group, its children are drawn there with it', () => {
    const f = fixture();
    const moved = f.rows.map((r) => (r.id === 'trip' ? ({ ...r, cells: { ...r.cells, cat: 'meals' } } as Row) : r));
    const { container } = render(<TableView {...f} rows={moved} />);
    expect(rowIdsIn(section(container, 'meals'))).toEqual(['trip', 'hotel', 'dinner', 'lunch', 'orphan']);
    expect(rowIdsIn(section(container, 'software'))).toEqual(['licence']);
  });

  it('a child has no grip: it is shown where its parent is', () => {
    const { container } = render(<TableView {...fixture()} onCellChange={() => {}} />);
    expect(rowEl(container, 'trip').querySelector('.dt-row-grip')).not.toBeNull();
    expect(rowEl(container, 'hotel').querySelector('.dt-row-grip')).toBeNull();
    expect(rowEl(container, 'orphan').querySelector('.dt-row-grip')).not.toBeNull();
  });

  it('a selection that holds a parent and its children writes the parent only', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(
      <TableView {...f} onCellChange={onCellChange} selectedRows={new Set(['trip', 'hotel', 'licence'])} onSelectionChange={() => {}} />,
    );
    drag(container, 'trip', 'meals').drop();
    expect(onCellChange.mock.calls).toEqual([['trip', 'cat', 'meals'], ['licence', 'cat', 'meals']]);
  });
});

describe('keyboard selection walks the rows as they are drawn', () => {
  it('Shift+ArrowDown from the first row selects the parent and then its first child', () => {
    const f = fixture();
    const onSelectionChange = vi.fn();
    const { container } = render(<TableView {...f} selectedRows={new Set()} onSelectionChange={onSelectionChange} />);
    const table = container.querySelector('.dt-table-view') as HTMLElement;
    fireEvent.click(rowEl(container, 'trip').querySelectorAll('td')[1]);
    fireEvent.keyDown(table, { key: 'ArrowDown', shiftKey: true });
    expect([...onSelectionChange.mock.calls.at(-1)![0]]).toEqual(['trip', 'hotel']);
  });
});
