/**
 * Formula Engine Module
 *
 * Provides Notion-like formula evaluation for data tables.
 *
 * @example
 * ```typescript
 * import { FormulaEngine } from '@marlinjai/data-table-core/formula';
 *
 * const engine = new FormulaEngine();
 * const result = engine.evaluate(
 *   'prop("Price") * prop("Quantity")',
 *   row,
 *   columns
 * );
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Parser Exports
// =============================================================================

export {
  FormulaParser,
  FormulaParseError,
  type ASTNode,
  type NumberLiteral,
  type StringLiteral,
  type BooleanLiteral,
  type PropertyReference,
  type BinaryExpression,
  type UnaryExpression,
  type FunctionCall,
  type ConditionalExpression,
  type BinaryOperator,
  type UnaryOperator,
} from './FormulaParser';

// =============================================================================
// Functions Exports
// =============================================================================

export {
  builtinFunctions,
  getFunction,
  hasFunction,
  getFunctionNames,
  helpers,
  type FormulaValue,
  type FormulaFunction,
  type FunctionDefinition,
} from './FormulaFunctions';

// =============================================================================
// Engine Exports
// =============================================================================

export {
  FormulaEngine,
  FormulaEvaluationError,
  createFormulaEngine,
  type FormulaResult,
  type FormulaEngineOptions,
} from './FormulaEngine';
