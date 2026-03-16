import { describe, it, expect } from 'vitest';
import { validateIdentifier, safeTableName, safeColumnName } from './identifiers.js';

describe('validateIdentifier', () => {
  it('accepts valid identifiers', () => {
    expect(validateIdentifier('col_abc123')).toBe('col_abc123');
    expect(validateIdentifier('tbl_abc')).toBe('tbl_abc');
    expect(validateIdentifier('a')).toBe('a');
    expect(validateIdentifier('a_b_c')).toBe('a_b_c');
  });

  it('rejects identifiers starting with numbers', () => {
    expect(() => validateIdentifier('123abc')).toThrow('Invalid SQL identifier');
  });

  it('rejects identifiers with uppercase letters', () => {
    expect(() => validateIdentifier('Col_ABC')).toThrow('Invalid SQL identifier');
  });

  it('rejects identifiers with special characters', () => {
    expect(() => validateIdentifier("col'; DROP TABLE--")).toThrow('Invalid SQL identifier');
    expect(() => validateIdentifier('col abc')).toThrow('Invalid SQL identifier');
    expect(() => validateIdentifier('col-abc')).toThrow('Invalid SQL identifier');
  });

  it('rejects empty strings', () => {
    expect(() => validateIdentifier('')).toThrow('Invalid SQL identifier');
  });

  it('rejects identifiers longer than 63 characters', () => {
    const long = 'a' + '_'.repeat(63);
    expect(() => validateIdentifier(long)).toThrow('Invalid SQL identifier');
  });
});

describe('safeTableName', () => {
  it('passes through tbl_ prefixed IDs', () => {
    expect(safeTableName('tbl_abc123')).toBe('tbl_abc123');
  });

  it('adds tbl_ prefix and strips hyphens from UUIDs', () => {
    expect(safeTableName('abc123')).toBe('tbl_abc123');
  });

  it('rejects unsafe table IDs', () => {
    expect(() => safeTableName("'; DROP TABLE--")).toThrow('Invalid SQL identifier');
  });
});

describe('safeColumnName', () => {
  it('validates and returns column IDs', () => {
    expect(safeColumnName('col_abc123')).toBe('col_abc123');
  });

  it('rejects unsafe column IDs', () => {
    expect(() => safeColumnName("col'; --")).toThrow('Invalid SQL identifier');
  });
});
