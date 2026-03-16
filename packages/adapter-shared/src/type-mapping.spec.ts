import { describe, it, expect } from 'vitest';
import {
  isScalarType,
  isJunctionType,
  isComputedType,
  serializeCell,
  deserializeCell,
} from './type-mapping.js';

describe('isScalarType', () => {
  it('returns true for scalar types', () => {
    expect(isScalarType('text')).toBe(true);
    expect(isScalarType('number')).toBe(true);
    expect(isScalarType('date')).toBe(true);
    expect(isScalarType('boolean')).toBe(true);
    expect(isScalarType('url')).toBe(true);
    expect(isScalarType('select')).toBe(true);
    expect(isScalarType('created_time')).toBe(true);
    expect(isScalarType('last_edited_time')).toBe(true);
  });

  it('returns false for junction types', () => {
    expect(isScalarType('multi_select')).toBe(false);
    expect(isScalarType('relation')).toBe(false);
    expect(isScalarType('file')).toBe(false);
  });

  it('returns false for computed types', () => {
    expect(isScalarType('formula')).toBe(false);
    expect(isScalarType('rollup')).toBe(false);
  });
});

describe('isJunctionType', () => {
  it('returns true for junction types', () => {
    expect(isJunctionType('multi_select')).toBe(true);
    expect(isJunctionType('relation')).toBe(true);
    expect(isJunctionType('file')).toBe(true);
  });
});

describe('isComputedType', () => {
  it('returns true for computed types', () => {
    expect(isComputedType('formula')).toBe(true);
    expect(isComputedType('rollup')).toBe(true);
  });
});

describe('serializeCell', () => {
  it('serializes text as-is', () => {
    expect(serializeCell('hello', 'text')).toBe('hello');
  });

  it('serializes numbers to strings', () => {
    expect(serializeCell(42, 'number')).toBe('42');
    expect(serializeCell(3.14, 'number')).toBe('3.14');
  });

  it('serializes booleans to "true"/"false"', () => {
    expect(serializeCell(true, 'boolean')).toBe('true');
    expect(serializeCell(false, 'boolean')).toBe('false');
  });

  it('serializes dates to ISO strings', () => {
    const date = new Date('2026-03-16T00:00:00.000Z');
    expect(serializeCell(date, 'date')).toBe('2026-03-16T00:00:00.000Z');
  });

  it('returns null for null values', () => {
    expect(serializeCell(null, 'text')).toBe(null);
  });

  it('returns null for NaN numbers', () => {
    expect(serializeCell('not-a-number', 'number')).toBe(null);
  });
});

describe('deserializeCell', () => {
  it('deserializes text as-is', () => {
    expect(deserializeCell('hello', 'text')).toBe('hello');
  });

  it('deserializes numbers from strings', () => {
    expect(deserializeCell('42', 'number')).toBe(42);
    expect(deserializeCell('3.14', 'number')).toBe(3.14);
  });

  it('returns null for invalid numbers', () => {
    expect(deserializeCell('not-a-number', 'number')).toBe(null);
  });

  it('deserializes booleans from strings', () => {
    expect(deserializeCell('true', 'boolean')).toBe(true);
    expect(deserializeCell('false', 'boolean')).toBe(false);
  });

  it('returns null for null values', () => {
    expect(deserializeCell(null, 'text')).toBe(null);
  });

  it('returns ISO string for dates (no Date object conversion)', () => {
    expect(deserializeCell('2026-03-16T00:00:00.000Z', 'date')).toBe('2026-03-16T00:00:00.000Z');
  });
});
