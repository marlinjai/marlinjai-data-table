import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { Column, SelectOption } from '@marlinjai/data-table-core';
import { DataTableProvider, type DataTableActions } from '../../providers/DataTableProvider';
import { useTable } from '../useTable';

/** A promise the test settles by hand, to hold a load in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const column = (id: string, type: string, position: number) =>
  ({ id, tableId: 't', name: id, type, position, width: 200 }) as unknown as Column;

/** A receipts-like table: one text column and three select columns. */
const columns = [
  column('name', 'text', 0),
  column('category', 'select', 1),
  column('status', 'select', 2),
  column('tags', 'multi_select', 3),
];

const options = (columnId: string) =>
  [{ id: `${columnId}-1`, columnId, name: `${columnId} one` }] as unknown as SelectOption[];

/**
 * Pattern C, as in the receipts app: no adapter, the columns come in as initial data
 * and every getSelectOptions call is a server action the test answers by hand.
 */
function setup(initialColumns: Column[] = columns, initialSelectOptions?: Record<string, SelectOption[]>) {
  const pending = new Map<string, ReturnType<typeof deferred<SelectOption[]>>[]>();
  const getSelectOptions = vi.fn((columnId: string) => {
    const d = deferred<SelectOption[]>();
    pending.set(columnId, [...(pending.get(columnId) ?? []), d]);
    return d.promise;
  });
  const createColumn = vi.fn(async (input: { name: string; type: string }) =>
    column(input.name, input.type, 9)
  );
  const makeActions = (): DataTableActions => ({
    getSelectOptions,
    createColumn: createColumn as unknown as DataTableActions['createColumn'],
  });
  let actions = makeActions();
  const initialData = { columns: initialColumns, selectOptions: initialSelectOptions };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <DataTableProvider workspaceId="w" actions={actions} initialData={initialData}>
      {children}
    </DataTableProvider>
  );
  const hook = renderHook(({ tableId }) => useTable({ tableId }), {
    wrapper,
    initialProps: { tableId: 't' },
  });

  /** Settle the oldest open request for a column, or the newest with `newest`. */
  const answer = async (
    columnId: string,
    outcome: SelectOption[] | Error = options(columnId),
    which: 'oldest' | 'newest' = 'oldest'
  ) => {
    const queue = pending.get(columnId) ?? [];
    const d = which === 'oldest' ? queue.shift() : queue.pop();
    if (!d) throw new Error(`no request open for ${columnId}`);
    await act(async () => {
      if (outcome instanceof Error) d.reject(outcome);
      else d.resolve(outcome);
    });
  };
  const askedFor = () => getSelectOptions.mock.calls.map(([id]) => id);
  /** Re-render with a new actions object, so the loading effect genuinely runs again. */
  const rerenderWithNewActions = (tableId = 't') => {
    actions = makeActions();
    hook.rerender({ tableId });
  };

  return { hook, answer, askedFor, getSelectOptions, rerenderWithNewActions };
}

describe('useTable loads select options', () => {
  it('asks for every missing select column once, all at the same time', async () => {
    const { hook, answer, askedFor } = setup();

    // All three requests are out before any of them is answered.
    expect(askedFor().sort()).toEqual(['category', 'status', 'tags']);

    await answer('category');
    await answer('status');
    await answer('tags');

    expect(askedFor()).toHaveLength(3);
    expect(hook.result.current.selectOptions.get('status')).toEqual(options('status'));
    expect(hook.result.current.selectOptionsError).toBeNull();
  });

  it('asks nothing again while a load is in flight, or after it has arrived', async () => {
    const { answer, askedFor, rerenderWithNewActions } = setup();
    expect(askedFor()).toHaveLength(3);

    rerenderWithNewActions();
    expect(askedFor()).toHaveLength(3);

    // Each answer changes selectOptions and re-renders; nothing is asked again.
    await answer('category');
    rerenderWithNewActions();
    await answer('status');
    await answer('tags');
    rerenderWithNewActions();

    expect(askedFor()).toHaveLength(3);
  });

  it('skips columns whose options came in as initial data', () => {
    const { askedFor } = setup(columns, { category: options('category') });
    expect(askedFor().sort()).toEqual(['status', 'tags']);
  });

  it('reports a failed column, keeps the others, and asks for it again on the next change', async () => {
    const { hook, answer, askedFor, rerenderWithNewActions } = setup();

    await answer('category');
    await answer('status', new Error('server action failed'));
    await answer('tags');

    expect(hook.result.current.selectOptions.has('category')).toBe(true);
    expect(hook.result.current.selectOptions.has('tags')).toBe(true);
    expect(hook.result.current.selectOptions.has('status')).toBe(false);
    expect(hook.result.current.selectOptionsError?.message).toBe('server action failed');

    rerenderWithNewActions();
    expect(askedFor().slice(3)).toEqual(['status']);

    await answer('status');
    expect(hook.result.current.selectOptions.get('status')).toEqual(options('status'));
    expect(hook.result.current.selectOptionsError).toBeNull();
  });

  it('loads a select column added later, and only that one', async () => {
    const { hook, answer, askedFor } = setup();
    await answer('category');
    await answer('status');
    await answer('tags');

    await act(async () => {
      await hook.result.current.addColumn({ name: 'project', type: 'select' } as never);
    });

    expect(askedFor().slice(3)).toEqual(['project']);
    await answer('project');
    expect(hook.result.current.selectOptions.get('project')).toEqual(options('project'));
  });

  it('starts afresh when the table changes, and drops answers for the old table', async () => {
    const { hook, answer, askedFor } = setup();
    await answer('category');

    // Switch while status and tags are still on their way.
    hook.rerender({ tableId: 'other' });
    expect(askedFor().slice(3).sort()).toEqual(['category', 'status', 'tags']);

    // The old table's late answers change nothing.
    await answer('status', options('stale'));
    await answer('tags', new Error('old table failed'));
    expect(hook.result.current.selectOptions.get('status')).toBeUndefined();
    expect(hook.result.current.selectOptionsError).toBeNull();

    await answer('category', options('fresh'));
    await answer('status');
    await answer('tags');
    expect(hook.result.current.selectOptions.get('category')).toEqual(options('fresh'));
    expect(askedFor()).toHaveLength(6);
  });

  it('loadSelectOptions always fetches, and its answer wins over an older one', async () => {
    const { hook, answer, askedFor } = setup();
    await answer('category');

    // A loaded column is fetched again on request.
    let reload!: Promise<void>;
    act(() => {
      reload = hook.result.current.loadSelectOptions('category');
    });
    expect(askedFor().slice(3)).toEqual(['category']);
    await answer('category', options('reloaded'));
    await act(() => reload);
    expect(hook.result.current.selectOptions.get('category')).toEqual(options('reloaded'));

    // A column on its way is fetched again too; the older answer arriving last is dropped.
    act(() => {
      reload = hook.result.current.loadSelectOptions('status');
    });
    expect(askedFor().slice(4)).toEqual(['status']);
    await answer('status', options('newer'), 'newest');
    await act(() => reload);
    await answer('status', options('older'));
    expect(hook.result.current.selectOptions.get('status')).toEqual(options('newer'));
  });

  it('loadSelectOptions reports and rethrows a failure', async () => {
    const { hook, answer } = setup();
    await answer('category');

    let reload!: Promise<void>;
    act(() => {
      reload = hook.result.current.loadSelectOptions('category');
    });
    const caught = reload.catch((err: Error) => err);
    await answer('category', new Error('reload failed'));
    expect((await caught)?.message).toBe('reload failed');
    expect(hook.result.current.selectOptionsError?.message).toBe('reload failed');
    // The options it had stay.
    expect(hook.result.current.selectOptions.get('category')).toEqual(options('category'));
  });
});
