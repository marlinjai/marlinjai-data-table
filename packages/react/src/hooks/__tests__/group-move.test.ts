import { describe, expect, it } from 'vitest';
import { EMPTY_GROUP_KEY, canMoveBetweenGroups, valueForGroupMove } from '../useGrouping';

describe('valueForGroupMove (the cell value that puts a row into another group)', () => {
  it('a select column takes the option of the target group', () => {
    expect(valueForGroupMove('select', 'opt_software', 'opt_software', 'opt_meals')).toEqual({ value: 'opt_meals' });
  });

  it('text and url columns take the group label as their value', () => {
    expect(valueForGroupMove('text', '4900', '4900', '4650')).toEqual({ value: '4650' });
    expect(valueForGroupMove('url', 'https://a.example', 'https://a.example', 'https://b.example')).toEqual({ value: 'https://b.example' });
  });

  it('a number column takes the number, not its text', () => {
    expect(valueForGroupMove('number', 7, '7', '19')).toEqual({ value: 19 });
  });

  it('a checkbox column takes true or false', () => {
    expect(valueForGroupMove('boolean', false, 'false', 'true')).toEqual({ value: true });
    expect(valueForGroupMove('boolean', true, 'true', 'false')).toEqual({ value: false });
  });

  it('moving into the group without a value clears the cell', () => {
    for (const type of ['select', 'text', 'url', 'number', 'boolean']) {
      expect(valueForGroupMove(type, 'x', 'x', EMPTY_GROUP_KEY), type).toEqual({ value: null });
    }
  });

  it('moving out of the group without a value sets it', () => {
    expect(valueForGroupMove('select', null, EMPTY_GROUP_KEY, 'opt_meals')).toEqual({ value: 'opt_meals' });
  });

  it('a multi-select row swaps the option of the group it left and keeps its other options', () => {
    expect(valueForGroupMove('multi_select', ['a', 'b'], 'a', 'c')).toEqual({ value: ['b', 'c'] });
    expect(valueForGroupMove('multi_select', [], EMPTY_GROUP_KEY, 'c')).toEqual({ value: ['c'] });
    expect(valueForGroupMove('multi_select', ['a'], 'a', EMPTY_GROUP_KEY)).toEqual({ value: [] });
  });

  it('a multi-select row that already carries the target option only loses the one it left', () => {
    expect(valueForGroupMove('multi_select', ['a', 'c'], 'a', 'c')).toEqual({ value: ['c'] });
  });

  it('nothing is written when the row stays in its group', () => {
    expect(valueForGroupMove('select', 'a', 'a', 'a')).toBeNull();
  });

  it('dates and computed columns cannot be written from a group', () => {
    for (const type of ['date', 'formula', 'rollup', 'relation', 'file', 'created_time', 'last_edited_time']) {
      expect(canMoveBetweenGroups(type), type).toBe(false);
      expect(valueForGroupMove(type, 'x', 'a', 'b'), type).toBeNull();
    }
  });

  it('a group key that is not a number is refused for a number column', () => {
    expect(valueForGroupMove('number', 1, '1', 'abc')).toBeNull();
  });
});
