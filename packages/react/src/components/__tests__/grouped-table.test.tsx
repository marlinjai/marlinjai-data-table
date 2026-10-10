import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import type { Column, Row, SelectOption } from '@marlinjai/data-table-core';
import { TableView } from '../TableView';

/** Two receipts in two categories, grouped by the select column. */
function fixture() {
  const columns = [
    { id: 'name', tableId: 't', name: 'Name', type: 'text', position: 0, width: 200, isPrimary: true },
    { id: 'cat', tableId: 't', name: 'Category', type: 'select', position: 1, width: 200 },
  ] as unknown as Column[];
  const rows = [
    { id: 'r1', tableId: 't', cells: { name: 'Shop receipt', cat: 'software' } },
    { id: 'r2', tableId: 't', cells: { name: 'Dinner', cat: 'meals' } },
    { id: 'r3', tableId: 't', cells: { name: 'Second shop receipt', cat: 'software' } },
  ] as unknown as Row[];
  const selectOptions = new Map<string, SelectOption[]>([
    ['cat', [{ id: 'software', name: 'Software' }, { id: 'meals', name: 'Meals' }] as unknown as SelectOption[]],
  ]);
  return { columns, rows, selectOptions, groupConfig: { columnId: 'cat', direction: 'asc' as const } };
}

function dataTransfer() {
  const data = new Map<string, string>();
  return { effectAllowed: '', dropEffect: '', setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', types: [] as string[] };
}

const section = (container: HTMLElement, key: string) => container.querySelector(`[data-group-key="${key}"]`) as HTMLElement;
const rowEl = (container: HTMLElement, id: string) => container.querySelector(`tr[data-row-id="${id}"]`) as HTMLElement;

describe('a grouped table keeps the full column header', () => {
  it('every group has a resize handle per column', () => {
    const f = fixture();
    const { container } = render(<TableView {...f} onColumnResize={() => {}} />);
    expect(container.querySelectorAll('.dt-group-section')).toHaveLength(2);
    expect(container.querySelectorAll('.dt-group-section .dt-resize-handle')).toHaveLength(4);
  });

  it('dragging a handle reports the width the column has when the mouse is released, once', () => {
    const f = fixture();
    const onColumnResize = vi.fn();
    const { container } = render(<TableView {...f} onColumnResize={onColumnResize} />);
    const handle = container.querySelector('.dt-group-section .dt-resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 340 });
    fireEvent.mouseMove(document, { clientX: 390 });
    fireEvent.mouseUp(document);

    expect(onColumnResize).toHaveBeenCalledTimes(1);
    expect(onColumnResize).toHaveBeenCalledWith('name', 290);
    // Every group's table follows: the width is shared.
    const widths = [...container.querySelectorAll('.dt-group-section')].map((s) => (s.querySelector('th.dt-column-header') as HTMLElement).style.width);
    expect(widths).toEqual(['290px', '290px']);
  });

  it('a column is not dragged below the minimum, and a click without movement reports nothing', () => {
    const f = fixture();
    const onColumnResize = vi.fn();
    const { container } = render(<TableView {...f} onColumnResize={onColumnResize} />);
    const handle = container.querySelector('.dt-resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent.mouseUp(document);
    expect(onColumnResize).not.toHaveBeenCalled();

    fireEvent.mouseDown(handle, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 10 });
    fireEvent.mouseUp(document);
    expect(onColumnResize).toHaveBeenCalledWith('name', 80);
  });

  it('the arrow keys resize from a focused handle', () => {
    const f = fixture();
    const onColumnResize = vi.fn();
    const { container } = render(<TableView {...f} onColumnResize={onColumnResize} />);
    const handle = container.querySelector('.dt-resize-handle') as HTMLElement;
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onColumnResize.mock.calls).toEqual([['name', 210], ['name', 170]]);
  });
});

describe('dragging a row into another group', () => {
  function drag(container: HTMLElement, rowId: string, targetKey: string) {
    const dt = dataTransfer();
    const row = rowEl(container, rowId);
    fireEvent.mouseDown(row.querySelector('.dt-row-grip') as HTMLElement);
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.dragOver(section(container, targetKey), { dataTransfer: dt });
    return { dt, row, drop: () => fireEvent.drop(section(container, targetKey), { dataTransfer: dt }) };
  }

  it('writes the grouped column with the target group’s value', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} />);

    const d = drag(container, 'r1', 'meals');
    expect(section(container, 'meals').className).toContain('dt-group-drop-target');
    expect(rowEl(container, 'r1').className).toContain('dt-row-dragging');
    d.drop();

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange).toHaveBeenCalledWith('r1', 'cat', 'meals');
    expect(container.querySelector('.dt-group-drop-target')).toBeNull();
    expect(container.querySelector('.dt-row-dragging')).toBeNull();
  });

  it('takes the whole selection along when the dragged row is one of the selected', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(
      <TableView {...f} onCellChange={onCellChange} selectedRows={new Set(['r1', 'r3'])} onSelectionChange={() => {}} />,
    );
    drag(container, 'r3', 'meals').drop();
    expect(onCellChange.mock.calls).toEqual([['r1', 'cat', 'meals'], ['r3', 'cat', 'meals']]);
  });

  it('dropping on the row’s own group writes nothing', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} />);
    drag(container, 'r1', 'software').drop();
    expect(onCellChange).not.toHaveBeenCalled();
    expect(container.querySelector('.dt-group-drop-target')).toBeNull();
  });

  it('a row is draggable only while its grip is held', () => {
    const f = fixture();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} />);
    const row = rowEl(container, 'r1');
    expect(row.getAttribute('draggable')).toBeNull();
    fireEvent.mouseDown(row.querySelector('.dt-row-grip') as HTMLElement);
    expect(rowEl(container, 'r1').getAttribute('draggable')).toBe('true');
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(rowEl(container, 'r1').getAttribute('draggable')).toBeNull();
  });

  it('there is no grip when the table is read-only, has no change handler, or groups by a column that cannot be written', () => {
    const f = fixture();
    expect(render(<TableView {...f} onCellChange={() => {}} readOnly />).container.querySelector('.dt-row-grip')).toBeNull();
    expect(render(<TableView {...f} />).container.querySelector('.dt-row-grip')).toBeNull();
    const dated = { ...f, columns: f.columns.map((c) => (c.id === 'cat' ? ({ ...c, type: 'date' } as Column) : c)) };
    expect(render(<TableView {...dated} onCellChange={() => {}} />).container.querySelector('.dt-row-grip')).toBeNull();
  });

  it('an ungrouped table has the resize handles and no grips', () => {
    const f = fixture();
    const { container } = render(<TableView columns={f.columns} rows={f.rows} selectOptions={f.selectOptions} onCellChange={() => {}} />);
    expect(container.querySelectorAll('.dt-resize-handle')).toHaveLength(2);
    expect(container.querySelector('.dt-row-grip')).toBeNull();
  });
});
