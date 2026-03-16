/**
 * DDL capability detection for different database providers.
 *
 * Different databases support different DDL operations. This module
 * detects what's safe to use on each provider.
 */

export interface DDLCapabilities {
  supportsDropColumn: boolean;
  supportsRenameColumn: boolean;
  supportsTransactionalDDL: boolean;
  supportsExpressionIndex: boolean;
}

export type DDLProvider = 'postgresql' | 'sqlite' | 'd1';

/**
 * Returns the DDL capabilities for a given database provider.
 */
export function detectCapabilities(provider: DDLProvider): DDLCapabilities {
  switch (provider) {
    case 'postgresql':
      return {
        supportsDropColumn: true,
        supportsRenameColumn: true,
        supportsTransactionalDDL: true,
        supportsExpressionIndex: true,
      };

    case 'sqlite':
      // SQLite 3.35+ supports DROP COLUMN, 3.25+ supports RENAME COLUMN
      // Expression indexes supported since 3.9+
      return {
        supportsDropColumn: true,
        supportsRenameColumn: true,
        supportsTransactionalDDL: false,
        supportsExpressionIndex: true,
      };

    case 'd1':
      // D1 is conservative — assume limited ALTER TABLE support
      return {
        supportsDropColumn: false,
        supportsRenameColumn: false,
        supportsTransactionalDDL: false,
        supportsExpressionIndex: false, // unverified on D1
      };
  }
}
