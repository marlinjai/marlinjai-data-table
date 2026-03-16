/**
 * SQL identifier sanitization for safe DDL operations.
 *
 * All table and column names in real tables use system-generated IDs
 * (e.g., tbl_abc123, col_def456). These are validated before use in
 * any SQL string to prevent injection.
 */

/** Matches safe SQL identifiers: starts with letter, alphanumeric + underscores, max 63 chars */
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Validates that a string is a safe SQL identifier.
 * Throws if the identifier contains invalid characters.
 */
export function validateIdentifier(name: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

/**
 * Converts a table ID to a safe SQL table name.
 * E.g., "tbl_abc123" stays as-is, UUIDs get "tbl_" prefix with hyphens removed.
 */
export function safeTableName(tableId: string): string {
  // If it already starts with tbl_, validate as-is
  if (tableId.startsWith('tbl_')) {
    return validateIdentifier(tableId);
  }
  // Otherwise, prefix with tbl_ and strip hyphens
  const sanitized = `tbl_${tableId.replace(/-/g, '')}`;
  return validateIdentifier(sanitized);
}

/**
 * Converts a column ID to a safe SQL column name.
 * Column IDs (e.g., "col_abc123") are used directly as SQL column names.
 */
export function safeColumnName(columnId: string): string {
  return validateIdentifier(columnId);
}
