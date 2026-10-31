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

describe('all groups are folded and unfolded at once', () => {
  const keys = (container: HTMLElement) => [...container.querySelectorAll('[data-group-key]')].map((el) => el.getAttribute('data-group-key') as string);
  const foldAll = (container: HTMLElement) => container.querySelector('.dt-group-fold-all button') as HTMLButtonElement | null;

  it('folding all writes every group into the group config, in one change', () => {
    const f = fixture();
    const onGroupConfigChange = vi.fn();
    const { container } = render(<TableView {...f} onGroupConfigChange={onGroupConfigChange} />);
    const button = foldAll(container) as HTMLButtonElement;
    expect(button.textContent).toBe('Collapse all');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(onGroupConfigChange).toHaveBeenCalledTimes(1);
    expect(onGroupConfigChange).toHaveBeenCalledWith({ ...f.groupConfig, collapsedGroups: keys(container) });
  });

  it('with every group folded the control unfolds all, and no rows are drawn until then', () => {
    const f = fixture();
    const onGroupConfigChange = vi.fn();
    const all = keys(render(<TableView {...f} />).container);
    const { container } = render(<TableView {...f} groupConfig={{ ...f.groupConfig, collapsedGroups: all }} onGroupConfigChange={onGroupConfigChange} />);
    expect(container.querySelectorAll('tr[data-row-id]')).toHaveLength(0);
    const button = foldAll(container) as HTMLButtonElement;
    expect(button.textContent).toBe('Expand all');
    fireEvent.click(button);
    expect(onGroupConfigChange).toHaveBeenCalledWith({ ...f.groupConfig, collapsedGroups: [] });
  });

  it('with only some groups folded it offers to fold the rest', () => {
    const f = fixture();
    const [first] = keys(render(<TableView {...f} />).container);
    const { container } = render(<TableView {...f} groupConfig={{ ...f.groupConfig, collapsedGroups: [first] }} onGroupConfigChange={() => {}} />);
    expect((foldAll(container) as HTMLButtonElement).textContent).toBe('Collapse all');
  });

  describe('with sub-items', () => {
    function nested() {
      const f = fixture();
      const [first, second, third] = f.rows;
      const rows = [first, second, { ...third, parentRowId: first.id }];
      return { ...f, rows, subItemsConfig: { enabled: true, collapsedParents: ['elsewhere'] } };
    }

    it('collapse all folds sections and parents in one call, and leaves other parents folded', () => {
      const f = nested();
      const onFoldAll = vi.fn();
      const onGroupConfigChange = vi.fn();
      const { container } = render(<TableView {...f} onFoldAll={onFoldAll} onGroupConfigChange={onGroupConfigChange} />);
      expect(rowEl(container, f.rows[2].id)).not.toBeNull();
      const groups = keys(container);
      fireEvent.click(foldAll(container) as HTMLElement);
      expect(onFoldAll).toHaveBeenCalledTimes(1);
      expect(onFoldAll).toHaveBeenCalledWith({ collapsedGroups: groups, collapsedParents: ['elsewhere', f.rows[0].id] });
      expect(onGroupConfigChange).not.toHaveBeenCalled();
    });

    it('a section opened after collapse all shows its parent folded', () => {
      const f = nested();
      const { container, rerender } = render(<TableView {...f} onFoldAll={() => {}} onGroupConfigChange={() => {}} />);
      fireEvent.click(foldAll(container) as HTMLElement);
      rerender(<TableView {...f} subItemsConfig={{ enabled: true, collapsedParents: ['elsewhere', f.rows[0].id] }} onFoldAll={() => {}} onGroupConfigChange={() => {}} />);
      expect(rowEl(container, f.rows[0].id)).not.toBeNull();
      expect(rowEl(container, f.rows[2].id)).toBeNull();
    });

    it('expand all opens sections and the parents at hand, not parents it cannot see', () => {
      const f = nested();
      const all = keys(render(<TableView {...f} />).container);
      const onFoldAll = vi.fn();
      const { container } = render(
        <TableView
          {...f}
          groupConfig={{ ...f.groupConfig, collapsedGroups: all }}
          subItemsConfig={{ enabled: true, collapsedParents: ['elsewhere', f.rows[0].id] }}
          onFoldAll={onFoldAll}
          onGroupConfigChange={() => {}}
        />,
      );
      fireEvent.click(foldAll(container) as HTMLElement);
      expect(onFoldAll).toHaveBeenCalledWith({ collapsedGroups: [], collapsedParents: ['elsewhere'] });
    });

    it('without onFoldAll only the sections fold, as before', () => {
      const f = nested();
      const onGroupConfigChange = vi.fn();
      const { container } = render(<TableView {...f} onGroupConfigChange={onGroupConfigChange} />);
      fireEvent.click(foldAll(container) as HTMLElement);
      expect(onGroupConfigChange).toHaveBeenCalledWith({ ...f.groupConfig, collapsedGroups: keys(container) });
    });
  });

  it('is not offered when the consumer cannot store the fold state', () => {
    const { container } = render(<TableView {...fixture()} />);
    expect(foldAll(container)).toBeNull();
  });
});

describe('moving rows under another parent by dragging', () => {
  /** Two groups with receipts and a loose receipt in one section, a second section beside it. */
  function nested() {
    const f = fixture();
    const base = { tableId: 't' };
    const rows = [
      { ...base, id: 'g1', cells: { name: 'Group one', cat: 'software' } },
      { ...base, id: 'a', parentRowId: 'g1', cells: { name: 'A', cat: 'software' } },
      { ...base, id: 'b', parentRowId: 'g1', cells: { name: 'B', cat: 'software' } },
      { ...base, id: 'g2', cells: { name: 'Group two', cat: 'software' } },
      { ...base, id: 'c', parentRowId: 'g2', cells: { name: 'C', cat: 'software' } },
      { ...base, id: 'loose', cells: { name: 'Loose', cat: 'software' } },
      { ...base, id: 'meal', cells: { name: 'Dinner', cat: 'meals' } },
    ] as unknown as Row[];
    return { ...f, rows, subItemsConfig: { enabled: true } };
  }

  function grab(container: HTMLElement, rowId: string) {
    const dt = dataTransfer();
    const row = rowEl(container, rowId);
    fireEvent.mouseDown(row.querySelector('.dt-row-grip') as HTMLElement);
    fireEvent.dragStart(row, { dataTransfer: dt });
    return dt;
  }

  it('a sub-item has a grip, and drops on another parent without writing the section', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} onMoveRows={onMoveRows} />);

    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    expect(rowEl(container, 'g2').className).toContain('dt-row-drop-target');
    expect(rowEl(container, 'c').className).toContain('dt-row-drop-target-child');
    expect(section(container, 'software').className).not.toContain('dt-group-drop-target');
    fireEvent.drop(rowEl(container, 'g2'), { dataTransfer: dt });

    expect(onMoveRows.mock.calls).toEqual([[['a'], 'g2']]);
    expect(onCellChange).not.toHaveBeenCalled();
    expect(container.querySelector('.dt-row-drop-target')).toBeNull();
    expect(container.querySelector('.dt-row-dragging')).toBeNull();
  });

  it('a drop on a sub-item counts as a drop on its parent', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const { container } = render(<TableView {...f} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'loose');
    fireEvent.dragOver(rowEl(container, 'c'), { dataTransfer: dt });
    fireEvent.drop(rowEl(container, 'c'), { dataTransfer: dt });
    expect(onMoveRows.mock.calls).toEqual([[['loose'], 'g2']]);
  });

  it('takes the selection along across parents, and leaves out rows already there', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const { container } = render(
      <TableView {...f} onMoveRows={onMoveRows} selectedRows={new Set(['a', 'c', 'loose'])} onSelectionChange={() => {}} />,
    );
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    fireEvent.drop(rowEl(container, 'g2'), { dataTransfer: dt });
    expect(onMoveRows.mock.calls).toEqual([[['a', 'loose'], 'g2']]);
  });

  it('a drop on the parent the row already lies under does nothing', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'b'), { dataTransfer: dt });
    expect(container.querySelector('.dt-row-drop-target')).toBeNull();
    fireEvent.drop(rowEl(container, 'b'), { dataTransfer: dt });
    expect(onMoveRows).not.toHaveBeenCalled();
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('a parent does not go under another parent: it only moves between sections', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'g1');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    expect(container.querySelector('.dt-row-drop-target')).toBeNull();
    fireEvent.drop(section(container, 'meals'), { dataTransfer: dt });
    expect(onMoveRows).not.toHaveBeenCalled();
    expect(onCellChange.mock.calls).toEqual([['g1', 'cat', 'meals']]);
  });

  it('a sub-item dropped in its own section leaves its parent, on a loose row too', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const onCellChange = vi.fn();
    const { container } = render(<TableView {...f} onCellChange={onCellChange} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'loose'), { dataTransfer: dt });
    expect(section(container, 'software').className).toContain('dt-group-drop-target');
    fireEvent.drop(rowEl(container, 'loose'), { dataTransfer: dt });
    expect(onMoveRows.mock.calls).toEqual([[['a'], null]]);
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('a sub-item dropped in another section leaves its parent and takes that section’s value, written first', () => {
    const f = nested();
    const calls: string[] = [];
    const { container } = render(
      <TableView {...f} onCellChange={() => calls.push('cell')} onMoveRows={() => calls.push('move')} />,
    );
    const dt = grab(container, 'a');
    fireEvent.dragOver(section(container, 'meals'), { dataTransfer: dt });
    fireEvent.drop(section(container, 'meals'), { dataTransfer: dt });
    expect(calls).toEqual(['cell', 'move']);
  });

  it('canHoldRows makes a parent of a row whose sub-items are all filtered out', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const rows = f.rows.filter((r) => r.id !== 'c');
    const { container } = render(<TableView {...f} rows={rows} onMoveRows={onMoveRows} canHoldRows={(r) => r.id.startsWith('g')} />);
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    fireEvent.drop(rowEl(container, 'g2'), { dataTransfer: dt });
    expect(onMoveRows.mock.calls).toEqual([[['a'], 'g2']]);
  });

  it('a drag let go outside leaves nothing behind, and the next drag starts clean', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const { container } = render(<TableView {...f} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    fireEvent.dragEnd(rowEl(container, 'a'), { dataTransfer: dt });
    expect(container.querySelector('.dt-row-drop-target')).toBeNull();
    expect(onMoveRows).not.toHaveBeenCalled();
    const again = grab(container, 'b');
    fireEvent.drop(rowEl(container, 'g2'), { dataTransfer: again });
    expect(onMoveRows.mock.calls).toEqual([[['b'], 'g2']]);
  });

  it('without onMoveRows a sub-item has no grip, and a table with sections behaves as before', () => {
    const f = nested();
    const { container } = render(<TableView {...f} onCellChange={() => {}} />);
    expect(rowEl(container, 'a').querySelector('.dt-row-grip')).toBeNull();
    expect(rowEl(container, 'loose').querySelector('.dt-row-grip')).not.toBeNull();
  });

  it('works without sections: on a parent, and back to the top level in the table body', () => {
    const f = nested();
    const onMoveRows = vi.fn();
    const { container } = render(<TableView {...f} groupConfig={undefined} onMoveRows={onMoveRows} />);
    const dt = grab(container, 'a');
    fireEvent.dragOver(rowEl(container, 'g2'), { dataTransfer: dt });
    fireEvent.drop(rowEl(container, 'g2'), { dataTransfer: dt });
    const out = grab(container, 'c');
    fireEvent.dragOver(rowEl(container, 'loose'), { dataTransfer: out });
    expect(container.querySelector('tbody.dt-group-drop-target')).not.toBeNull();
    fireEvent.drop(rowEl(container, 'loose'), { dataTransfer: out });
    expect(onMoveRows.mock.calls).toEqual([[['a'], 'g2'], [['c'], null]]);
  });

  it('shows the grip of a selected row without hovering, with the label given', () => {
    const f = nested();
    const { container } = render(
      <TableView {...f} onMoveRows={() => {}} rowGripLabel="Ziehen zum Verschieben" selectedRows={new Set(['a'])} onSelectionChange={() => {}} />,
    );
    expect(rowEl(container, 'a').getAttribute('data-row-selected')).toBe('true');
    expect(rowEl(container, 'a').querySelector('.dt-row-grip')?.getAttribute('title')).toBe('Ziehen zum Verschieben');
  });
});
