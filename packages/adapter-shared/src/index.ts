// Identifier sanitization
export { validateIdentifier, safeTableName, safeColumnName } from './identifiers.js';

// Type mapping (scalar vs junction vs computed)
export {
  isScalarType,
  isJunctionType,
  isComputedType,
  serializeCell,
  deserializeCell,
} from './type-mapping.js';

// Query building (WHERE, ORDER BY, CAST)
export {
  buildWhereClause,
  buildOrderBy,
  buildCastExpression,
  type DatabaseProvider,
  type WhereClauseResult,
} from './query-builder.js';

// DDL capabilities
export {
  detectCapabilities,
  type DDLCapabilities,
  type DDLProvider,
} from './ddl-capabilities.js';

// Schema verification and repair
export {
  verifySchemaConsistency,
  generateRepairStatements,
  type SchemaReport,
} from './schema-verify.js';

// Batch loading utilities
export {
  mergeFiles,
  mergeRelations,
  mergeSelections,
  buildBatchMap,
  type BatchFileResult,
  type BatchRelationResult,
  type BatchSelectResult,
} from './batch-loader.js';
