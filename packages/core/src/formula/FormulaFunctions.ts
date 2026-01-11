/**
 * Built-in Functions for the Formula Engine
 *
 * Provides Notion-like formula functions for math, text, logic, and dates.
 */

import type { CellValue } from '../types';

/**
 * Function argument type
 */
export type FormulaValue = string | number | boolean | Date | null | undefined;

/**
 * Function implementation signature
 */
export type FormulaFunction = (...args: FormulaValue[]) => FormulaValue;

/**
 * Function metadata
 */
export interface FunctionDefinition {
  /** Function implementation */
  fn: FormulaFunction;
  /** Minimum number of arguments */
  minArgs?: number;
  /** Maximum number of arguments (undefined = unlimited) */
  maxArgs?: number;
  /** Function description */
  description: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a value to a number, returning null if not possible
 */
function toNumber(value: FormulaValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

/**
 * Convert a value to a string
 */
function toString(value: FormulaValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Convert a value to a boolean
 */
function toBoolean(value: FormulaValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (value instanceof Date) return true;
  return false;
}

/**
 * Convert a value to a Date
 */
function toDate(value: FormulaValue): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Check if a value is empty
 */
function isEmpty(value: FormulaValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// =============================================================================
// Math Functions
// =============================================================================

const mathFunctions: Record<string, FunctionDefinition> = {
  /**
   * Add two or more numbers
   */
  add: {
    fn: (...args) => {
      const numbers = args.map(toNumber);
      if (numbers.some((n) => n === null)) return null;
      return numbers.reduce((sum, n) => (sum as number) + (n as number), 0);
    },
    minArgs: 2,
    description: 'Add two or more numbers together',
  },

  /**
   * Subtract second number from first
   */
  subtract: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return null;
      return numA - numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Subtract second number from first',
  },

  /**
   * Multiply two or more numbers
   */
  multiply: {
    fn: (...args) => {
      const numbers = args.map(toNumber);
      if (numbers.some((n) => n === null)) return null;
      return numbers.reduce((prod, n) => (prod as number) * (n as number), 1);
    },
    minArgs: 2,
    description: 'Multiply two or more numbers together',
  },

  /**
   * Divide first number by second
   */
  divide: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return null;
      if (numB === 0) return null;
      return numA / numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Divide first number by second',
  },

  /**
   * Modulo (remainder) of division
   */
  mod: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return null;
      if (numB === 0) return null;
      return numA % numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Get the remainder of division',
  },

  /**
   * Absolute value
   */
  abs: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null) return null;
      return Math.abs(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the absolute value of a number',
  },

  /**
   * Round to nearest integer or specified decimal places
   */
  round: {
    fn: (a, decimals = 0) => {
      const num = toNumber(a);
      const dec = toNumber(decimals) ?? 0;
      if (num === null) return null;
      const multiplier = Math.pow(10, dec);
      return Math.round(num * multiplier) / multiplier;
    },
    minArgs: 1,
    maxArgs: 2,
    description: 'Round to nearest integer or specified decimal places',
  },

  /**
   * Round down to nearest integer
   */
  floor: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null) return null;
      return Math.floor(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Round down to nearest integer',
  },

  /**
   * Round up to nearest integer
   */
  ceil: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null) return null;
      return Math.ceil(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Round up to nearest integer',
  },

  /**
   * Minimum of all arguments
   */
  min: {
    fn: (...args) => {
      const numbers = args.map(toNumber).filter((n): n is number => n !== null);
      if (numbers.length === 0) return null;
      return Math.min(...numbers);
    },
    minArgs: 1,
    description: 'Get the minimum value',
  },

  /**
   * Maximum of all arguments
   */
  max: {
    fn: (...args) => {
      const numbers = args.map(toNumber).filter((n): n is number => n !== null);
      if (numbers.length === 0) return null;
      return Math.max(...numbers);
    },
    minArgs: 1,
    description: 'Get the maximum value',
  },

  /**
   * Power (exponentiation)
   */
  pow: {
    fn: (base, exponent) => {
      const numBase = toNumber(base);
      const numExp = toNumber(exponent);
      if (numBase === null || numExp === null) return null;
      return Math.pow(numBase, numExp);
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Raise a number to a power',
  },

  /**
   * Square root
   */
  sqrt: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null || num < 0) return null;
      return Math.sqrt(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the square root of a number',
  },

  /**
   * Sign of a number (-1, 0, or 1)
   */
  sign: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null) return null;
      return Math.sign(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the sign of a number (-1, 0, or 1)',
  },

  /**
   * Natural logarithm
   */
  ln: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null || num <= 0) return null;
      return Math.log(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the natural logarithm of a number',
  },

  /**
   * Base-10 logarithm
   */
  log10: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null || num <= 0) return null;
      return Math.log10(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the base-10 logarithm of a number',
  },

  /**
   * Exponential (e^x)
   */
  exp: {
    fn: (a) => {
      const num = toNumber(a);
      if (num === null) return null;
      return Math.exp(num);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get e raised to a power',
  },
};

// =============================================================================
// Text Functions
// =============================================================================

const textFunctions: Record<string, FunctionDefinition> = {
  /**
   * Concatenate strings
   */
  concat: {
    fn: (...args) => {
      return args.map(toString).join('');
    },
    minArgs: 1,
    description: 'Concatenate multiple values into a single string',
  },

  /**
   * Get length of string
   */
  length: {
    fn: (a) => {
      return toString(a).length;
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the length of a string',
  },

  /**
   * Check if string contains substring
   */
  contains: {
    fn: (str, search) => {
      return toString(str).includes(toString(search));
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if a string contains a substring',
  },

  /**
   * Replace occurrences in string
   */
  replace: {
    fn: (str, search, replacement) => {
      return toString(str).split(toString(search)).join(toString(replacement));
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Replace all occurrences of a substring',
  },

  /**
   * Replace first occurrence only
   */
  replaceFirst: {
    fn: (str, search, replacement) => {
      return toString(str).replace(toString(search), toString(replacement));
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Replace first occurrence of a substring',
  },

  /**
   * Convert to lowercase
   */
  lower: {
    fn: (a) => {
      return toString(a).toLowerCase();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Convert string to lowercase',
  },

  /**
   * Convert to uppercase
   */
  upper: {
    fn: (a) => {
      return toString(a).toUpperCase();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Convert string to uppercase',
  },

  /**
   * Trim whitespace
   */
  trim: {
    fn: (a) => {
      return toString(a).trim();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Remove leading and trailing whitespace',
  },

  /**
   * Extract substring
   */
  slice: {
    fn: (str, start, end) => {
      const s = toString(str);
      const startIdx = toNumber(start) ?? 0;
      const endIdx = end !== undefined ? toNumber(end) : undefined;
      return s.slice(startIdx, endIdx ?? undefined);
    },
    minArgs: 2,
    maxArgs: 3,
    description: 'Extract a portion of a string',
  },

  /**
   * Split string into array (returns first element or joined string)
   */
  split: {
    fn: (str, separator, index) => {
      const parts = toString(str).split(toString(separator));
      const idx = toNumber(index);
      if (idx !== null && idx >= 0 && idx < parts.length) {
        return parts[idx];
      }
      return parts.join(', ');
    },
    minArgs: 2,
    maxArgs: 3,
    description: 'Split a string by a separator',
  },

  /**
   * Test if string starts with prefix
   */
  startsWith: {
    fn: (str, prefix) => {
      return toString(str).startsWith(toString(prefix));
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if a string starts with a prefix',
  },

  /**
   * Test if string ends with suffix
   */
  endsWith: {
    fn: (str, suffix) => {
      return toString(str).endsWith(toString(suffix));
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if a string ends with a suffix',
  },

  /**
   * Find index of substring
   */
  indexOf: {
    fn: (str, search) => {
      const index = toString(str).indexOf(toString(search));
      return index === -1 ? null : index;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Find the index of a substring',
  },

  /**
   * Repeat string n times
   */
  repeat: {
    fn: (str, count) => {
      const n = toNumber(count) ?? 0;
      if (n < 0 || n > 10000) return null;
      return toString(str).repeat(Math.floor(n));
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Repeat a string n times',
  },

  /**
   * Pad string on the left
   */
  padStart: {
    fn: (str, length, fillStr) => {
      const len = toNumber(length) ?? 0;
      return toString(str).padStart(len, toString(fillStr) || ' ');
    },
    minArgs: 2,
    maxArgs: 3,
    description: 'Pad a string on the left to reach a target length',
  },

  /**
   * Pad string on the right
   */
  padEnd: {
    fn: (str, length, fillStr) => {
      const len = toNumber(length) ?? 0;
      return toString(str).padEnd(len, toString(fillStr) || ' ');
    },
    minArgs: 2,
    maxArgs: 3,
    description: 'Pad a string on the right to reach a target length',
  },

  /**
   * Format a value as string
   */
  format: {
    fn: (value) => {
      return toString(value);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Convert a value to a string',
  },

  /**
   * Parse a string as number
   */
  toNumber: {
    fn: (value) => {
      return toNumber(value);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Convert a string to a number',
  },
};

// =============================================================================
// Logical Functions
// =============================================================================

const logicalFunctions: Record<string, FunctionDefinition> = {
  /**
   * Conditional: if(condition, trueValue, falseValue)
   */
  if: {
    fn: (condition, trueValue, falseValue) => {
      return toBoolean(condition) ? trueValue : falseValue;
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Return one value if condition is true, another if false',
  },

  /**
   * Logical AND
   */
  and: {
    fn: (...args) => {
      return args.every(toBoolean);
    },
    minArgs: 1,
    description: 'Return true if all arguments are true',
  },

  /**
   * Logical OR
   */
  or: {
    fn: (...args) => {
      return args.some(toBoolean);
    },
    minArgs: 1,
    description: 'Return true if any argument is true',
  },

  /**
   * Logical NOT
   */
  not: {
    fn: (a) => {
      return !toBoolean(a);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Return the logical negation of a value',
  },

  /**
   * Check if value is empty
   */
  empty: {
    fn: (a) => {
      return isEmpty(a);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Check if a value is empty',
  },

  /**
   * Return first non-empty value
   */
  coalesce: {
    fn: (...args) => {
      for (const arg of args) {
        if (!isEmpty(arg)) return arg;
      }
      return null;
    },
    minArgs: 1,
    description: 'Return the first non-empty value',
  },

  /**
   * Equality check
   */
  equal: {
    fn: (a, b) => {
      if (a === null || a === undefined) return b === null || b === undefined;
      if (b === null || b === undefined) return false;
      if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
      if (a instanceof Date) return a.getTime() === toNumber(b);
      if (b instanceof Date) return toNumber(a) === b.getTime();
      return a === b;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if two values are equal',
  },

  /**
   * Inequality check
   */
  unequal: {
    fn: (a, b) => {
      const eq = logicalFunctions.equal.fn(a, b);
      return !eq;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if two values are not equal',
  },

  /**
   * Greater than
   */
  larger: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return false;
      return numA > numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if first value is greater than second',
  },

  /**
   * Less than
   */
  smaller: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return false;
      return numA < numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if first value is less than second',
  },

  /**
   * Greater than or equal
   */
  largerEq: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return false;
      return numA >= numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if first value is greater than or equal to second',
  },

  /**
   * Less than or equal
   */
  smallerEq: {
    fn: (a, b) => {
      const numA = toNumber(a);
      const numB = toNumber(b);
      if (numA === null || numB === null) return false;
      return numA <= numB;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Check if first value is less than or equal to second',
  },
};

// =============================================================================
// Date Functions
// =============================================================================

const dateFunctions: Record<string, FunctionDefinition> = {
  /**
   * Get current date/time
   */
  now: {
    fn: () => {
      return new Date();
    },
    minArgs: 0,
    maxArgs: 0,
    description: 'Get the current date and time',
  },

  /**
   * Get today's date (no time component)
   */
  today: {
    fn: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
    minArgs: 0,
    maxArgs: 0,
    description: "Get today's date without time",
  },

  /**
   * Add time to a date
   */
  dateAdd: {
    fn: (date, amount, unit) => {
      const d = toDate(date);
      const n = toNumber(amount);
      const u = toString(unit).toLowerCase();
      if (d === null || n === null) return null;

      const result = new Date(d);

      switch (u) {
        case 'years':
        case 'year':
          result.setFullYear(result.getFullYear() + n);
          break;
        case 'months':
        case 'month':
          result.setMonth(result.getMonth() + n);
          break;
        case 'weeks':
        case 'week':
          result.setDate(result.getDate() + n * 7);
          break;
        case 'days':
        case 'day':
          result.setDate(result.getDate() + n);
          break;
        case 'hours':
        case 'hour':
          result.setHours(result.getHours() + n);
          break;
        case 'minutes':
        case 'minute':
          result.setMinutes(result.getMinutes() + n);
          break;
        case 'seconds':
        case 'second':
          result.setSeconds(result.getSeconds() + n);
          break;
        default:
          return null;
      }

      return result;
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Add a time interval to a date',
  },

  /**
   * Subtract time from a date
   */
  dateSubtract: {
    fn: (date, amount, unit) => {
      const n = toNumber(amount);
      if (n === null) return null;
      return dateFunctions.dateAdd.fn(date, -n, unit);
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Subtract a time interval from a date',
  },

  /**
   * Get the difference between two dates
   */
  dateBetween: {
    fn: (date1, date2, unit) => {
      const d1 = toDate(date1);
      const d2 = toDate(date2);
      const u = toString(unit).toLowerCase();
      if (d1 === null || d2 === null) return null;

      const diffMs = d1.getTime() - d2.getTime();

      switch (u) {
        case 'years':
        case 'year':
          return d1.getFullYear() - d2.getFullYear();
        case 'months':
        case 'month':
          return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());
        case 'weeks':
        case 'week':
          return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        case 'days':
        case 'day':
          return Math.floor(diffMs / (24 * 60 * 60 * 1000));
        case 'hours':
        case 'hour':
          return Math.floor(diffMs / (60 * 60 * 1000));
        case 'minutes':
        case 'minute':
          return Math.floor(diffMs / (60 * 1000));
        case 'seconds':
        case 'second':
          return Math.floor(diffMs / 1000);
        default:
          return diffMs;
      }
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Get the difference between two dates in the specified unit',
  },

  /**
   * Format a date as string
   */
  formatDate: {
    fn: (date, formatStr) => {
      const d = toDate(date);
      if (d === null) return null;

      const format = toString(formatStr) || 'YYYY-MM-DD';

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const seconds = d.getSeconds();

      const pad = (n: number) => n.toString().padStart(2, '0');

      let result = format;
      result = result.replace(/YYYY/g, year.toString());
      result = result.replace(/YY/g, year.toString().slice(-2));
      result = result.replace(/MM/g, pad(month));
      result = result.replace(/M/g, month.toString());
      result = result.replace(/DD/g, pad(day));
      result = result.replace(/D/g, day.toString());
      result = result.replace(/HH/g, pad(hours));
      result = result.replace(/H/g, hours.toString());
      result = result.replace(/mm/g, pad(minutes));
      result = result.replace(/m/g, minutes.toString());
      result = result.replace(/ss/g, pad(seconds));
      result = result.replace(/s/g, seconds.toString());

      return result;
    },
    minArgs: 1,
    maxArgs: 2,
    description: 'Format a date as a string',
  },

  /**
   * Get year from date
   */
  year: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getFullYear();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the year from a date',
  },

  /**
   * Get month from date (1-12)
   */
  month: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getMonth() + 1;
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the month from a date (1-12)',
  },

  /**
   * Get day of month from date
   */
  day: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getDate();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the day of month from a date',
  },

  /**
   * Get day of week (0 = Sunday, 6 = Saturday)
   */
  dayOfWeek: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getDay();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the day of week (0 = Sunday, 6 = Saturday)',
  },

  /**
   * Get hour from date (0-23)
   */
  hour: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getHours();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the hour from a date (0-23)',
  },

  /**
   * Get minute from date (0-59)
   */
  minute: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getMinutes();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the minute from a date (0-59)',
  },

  /**
   * Get second from date (0-59)
   */
  second: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getSeconds();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the second from a date (0-59)',
  },

  /**
   * Get timestamp (milliseconds since epoch)
   */
  timestamp: {
    fn: (date) => {
      const d = toDate(date);
      if (d === null) return null;
      return d.getTime();
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Get the timestamp (milliseconds since epoch)',
  },

  /**
   * Create a date from components
   */
  date: {
    fn: (year, month, day) => {
      const y = toNumber(year);
      const m = toNumber(month);
      const d = toNumber(day);
      if (y === null || m === null || d === null) return null;
      return new Date(y, m - 1, d);
    },
    minArgs: 3,
    maxArgs: 3,
    description: 'Create a date from year, month, and day',
  },

  /**
   * Parse a date from string
   */
  parseDate: {
    fn: (str) => {
      return toDate(str);
    },
    minArgs: 1,
    maxArgs: 1,
    description: 'Parse a date from a string',
  },

  /**
   * Get start of day/week/month/year
   */
  startOf: {
    fn: (date, unit) => {
      const d = toDate(date);
      const u = toString(unit).toLowerCase();
      if (d === null) return null;

      const result = new Date(d);

      switch (u) {
        case 'year':
          result.setMonth(0, 1);
          result.setHours(0, 0, 0, 0);
          break;
        case 'month':
          result.setDate(1);
          result.setHours(0, 0, 0, 0);
          break;
        case 'week':
          result.setDate(result.getDate() - result.getDay());
          result.setHours(0, 0, 0, 0);
          break;
        case 'day':
          result.setHours(0, 0, 0, 0);
          break;
        case 'hour':
          result.setMinutes(0, 0, 0);
          break;
        default:
          return null;
      }

      return result;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Get the start of a time period',
  },

  /**
   * Get end of day/week/month/year
   */
  endOf: {
    fn: (date, unit) => {
      const d = toDate(date);
      const u = toString(unit).toLowerCase();
      if (d === null) return null;

      const result = new Date(d);

      switch (u) {
        case 'year':
          result.setMonth(11, 31);
          result.setHours(23, 59, 59, 999);
          break;
        case 'month':
          result.setMonth(result.getMonth() + 1, 0);
          result.setHours(23, 59, 59, 999);
          break;
        case 'week':
          result.setDate(result.getDate() + (6 - result.getDay()));
          result.setHours(23, 59, 59, 999);
          break;
        case 'day':
          result.setHours(23, 59, 59, 999);
          break;
        case 'hour':
          result.setMinutes(59, 59, 999);
          break;
        default:
          return null;
      }

      return result;
    },
    minArgs: 2,
    maxArgs: 2,
    description: 'Get the end of a time period',
  },
};

// =============================================================================
// Combined Function Registry
// =============================================================================

/**
 * All built-in formula functions
 */
export const builtinFunctions: Record<string, FunctionDefinition> = {
  ...mathFunctions,
  ...textFunctions,
  ...logicalFunctions,
  ...dateFunctions,
};

/**
 * Get a function by name
 * @param name Function name (case-insensitive)
 * @returns Function definition or undefined if not found
 */
export function getFunction(name: string): FunctionDefinition | undefined {
  return builtinFunctions[name.toLowerCase()];
}

/**
 * Check if a function exists
 * @param name Function name (case-insensitive)
 * @returns true if function exists
 */
export function hasFunction(name: string): boolean {
  return name.toLowerCase() in builtinFunctions;
}

/**
 * Get all function names
 * @returns Array of function names
 */
export function getFunctionNames(): string[] {
  return Object.keys(builtinFunctions);
}

/**
 * Export helper functions for use in evaluator
 */
export const helpers = {
  toNumber,
  toString,
  toBoolean,
  toDate,
  isEmpty,
};
