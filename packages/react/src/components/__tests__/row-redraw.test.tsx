// @vitest-environment jsdom
import { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellValue, Column, Row } from '@marlinjai/data-table-core';

// Counts which row each drawn cell belongs to: the cell's `onChange` is the one thing that tells them apart.
const drawn = vi.hoisted(() => ({ cells: [] as string[] }));
vi.mock('../cells/CellRenderer', () => ({
  CellRenderer: ({ value, column, onChange }: { value: CellValue; column: Column; onChange: (value: CellValue) => void }) => {
    drawn.cells.push(`${String(value)}`);
    return <button type="button" data-cell={column.id} onClick={() => onChange('new')}>{String(value)}</button>;
  },
}));

import { TableView } from '../TableView';

const columns = [
  { id: 'name', tableId: 't', name: 'Name', type: 'text', position: 0, width: 200, isPrimary: true },
  { id: 'gross', tableId: 't', name: 'Gross', type: 'number', position: 1, width: 120 },
] as unknown as Column[];

const row = (id: string, gross: number, parentRowId?: string): Row => ({ id, tableId: 't', parentRowId, cells: { name: id, gross } }) as unknown as Row;

const trip = row('trip', 0);
const hotel = row('hotel', 100, 'trip');
const dinner = row('dinner', 40, 'trip');
const licence = row('licence', 10);
const lunch = row('lunch', 5);

type TableProps = Partial<React.ComponentProps<typeof TableView>>;

function table(props: TableProps = {}, start: Row[] = [licence, lunch]) {
  let change!: (rows: Row[]) => void;
  let reprops!: (next: TableProps) => void;
  function Host() {
    const [rows, setRows] = useState(start);
    const [more, setMore] = useState<TableProps>({});
    change = (next) => act(() => setRows(next));
    reprops = (next) => act(() => setMore(next));
    return <TableView columns={columns} rows={rows} onCellChange={() => {}} {...props} {...more} />;
  }
  const view = render(<Host />);
  drawn.cells.length = 0;
  return { ...view, change: (next: Row[]) => change(next), reprops: (next: TableProps) => reprops(next) };
}

describe('a row redraws by its record', () => {
  beforeEach(() => {
    drawn.cells.length = 0;
  });

  it('draws only the row whose record changed', () => {
    const { change } = table();
    change([{ ...licence, cells: { ...licence.cells, gross: 11 } }, lunch]);
    expect(drawn.cells).toEqual(['licence', '11']);
  });

  it('draws nothing for a new list of the same records', () => {
    const { change } = table();
    change([licence, lunch]);
    expect(drawn.cells).toEqual([]);
  });

  it('draws what was added, and takes away what is gone, leaving the rest', () => {
    const { change, container } = table();
    change([licence, row('new', 1)]);
    expect(drawn.cells).toEqual(['new', '1']);
    expect([...container.querySelectorAll('tr[data-row-id]')].map((tr) => tr.getAttribute('data-row-id'))).toEqual(['licence', 'new']);
  });

  it('calls the handler of the latest render from a row that did not redraw', () => {
    const first = vi.fn();
    const second = vi.fn();
    const onRowOpen = vi.fn();
    const { reprops, container } = table({ onCellChange: first, onRowOpen });
    reprops({ onCellChange: second });
    expect(drawn.cells).toEqual([]);
    fireEvent.click(container.querySelector('tr[data-row-id="lunch"] [data-cell="gross"]')!);
    expect(second).toHaveBeenCalledWith('lunch', 'gross', 'new');
    expect(first).not.toHaveBeenCalled();
  });

  it('redraws a row whose selection changed, and only that row', () => {
    const { reprops, container } = table({ onSelectionChange: () => {}, selectedRows: new Set<string>() });
    reprops({ selectedRows: new Set(['lunch']) });
    expect(drawn.cells).toEqual(['lunch', '5']);
    expect(container.querySelector('tr[data-row-id="lunch"]')?.getAttribute('data-row-selected')).toBe('true');
    expect(container.querySelector('tr[data-row-id="licence"]')?.getAttribute('data-row-selected')).toBeNull();
  });

  it('moves the keyboard highlight by redrawing the two rows it leaves and reaches', () => {
    const { container } = table({ enableKeyboardNav: true });
    fireEvent.click(container.querySelector('tr[data-row-id="licence"] td')!);
    expect(container.querySelector('tr[data-row-active]')?.getAttribute('data-row-id')).toBe('licence');
    drawn.cells.length = 0;
    fireEvent.click(container.querySelector('tr[data-row-id="lunch"] td')!);
    expect(container.querySelector('tr[data-row-active]')?.getAttribute('data-row-id')).toBe('lunch');
    expect(drawn.cells.sort()).toEqual(['10', '5', 'licence', 'lunch']);
  });

  it('redraws a parent when one of its children changed, because its sum did', () => {
    const sum = (_row: Row, children: Row[], column: Column) =>
      column.id === 'gross' && children.length > 0 ? children.reduce((total, child) => total + Number(child.cells.gross), 0) : undefined;
    const { change } = table({ subItemsConfig: { enabled: true }, getSubItemSummary: sum }, [trip, hotel, dinner, licence]);
    change([trip, hotel, { ...dinner, cells: { ...dinner.cells, gross: 60 } }, licence]);
    // The parent with its new sum and the child; neither the other child nor the row beside them.
    expect(drawn.cells).toEqual(['trip', '160', 'dinner', '60']);
  });

  it('draws every row again when a column changes', () => {
    const { reprops } = table();
    reprops({ columns: [{ ...columns[0], name: 'Titel' } as Column, columns[1]] });
    expect(drawn.cells).toHaveLength(4);
  });
});
