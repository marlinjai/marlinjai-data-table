/**
 * Formula Engine for Notion-like data table
 *
 * Main engine that parses and evaluates formulas against row data.
 */

import type { Row, Column, CellValue } from '../types';
import {
  FormulaParser,
  FormulaParseError,
  type ASTNode,
  type BinaryOperator,
  type UnaryOperator,
} from './FormulaParser';
import {
  getFunction,
  hasFunction,
  helpers,
  type FormulaValue,
} from './FormulaFunctions';

// =============================================================================
// Types
// =============================================================================

/**
 * Error thrown during formula evaluation
 */
export class FormulaEvaluationError extends Error {
  public cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'FormulaEvaluationError';
    this.cause = cause;
  }
}

/**
 * Result of formula evaluation
 */
export interface FormulaResult {
  /** The computed value, or null on error */
  value: CellValue;
  /** Error message if evaluation failed */
  error?: string;
}

/**
 * Options for the FormulaEngine
 */
export interface FormulaEngineOptions {
  /** Whether to throw errors or return null on evaluation failure */
  throwOnError?: boolean;
  /** Maximum evaluation depth (to prevent infinite recursion) */
  maxDepth?: number;
  /** Custom functions to add to the engine */
  customFunctions?: Record<string, (...args: FormulaValue[]) => FormulaValue>;
}

// =============================================================================
// Evaluation Context
// =============================================================================

interface EvaluationContext {
  row: Row;
  columns: Column[];
  columnsByName: Map<string, Column>;
  columnsById: Map<string, Column>;
  depth: number;
  maxDepth: number;
  customFunctions: Record<string, (...args: FormulaValue[]) => FormulaValue>;
}

// =============================================================================
// Formula Engine
// =============================================================================

/**
 * Formula Engine for evaluating Notion-like formulas against row data.
 *
 * @example
 * ```typescript
 * const engine = new FormulaEngine();
 * const result = engine.evaluate(
 *   'prop("Price") * prop("Quantity")',
 *   row,
 *   columns
 * );
 * // result = 150 (if Price=10, Quantity=15)
 * ```
 */
export class FormulaEngine {
  private parser: FormulaParser;
  private options: Required<FormulaEngineOptions>;
  private astCache: Map<string, ASTNode> = new Map();

  /**
   * Create a new FormulaEngine
   * @param options Configuration options
   */
  constructor(options: FormulaEngineOptions = {}) {
    this.parser = new FormulaParser();
    this.options = {
      throwOnError: options.throwOnError ?? false,
      maxDepth: options.maxDepth ?? 100,
      customFunctions: options.customFunctions ?? {},
    };
  }

  /**
   * Evaluate a formula against row data
   *
   * @param formula The formula string to evaluate
   * @param row The row data containing cell values
   * @param columns The column definitions for the table
   * @returns The computed value, or null on error
   *
   * @example
   * ```typescript
   * // Simple arithmetic with property references
   * engine.evaluate('prop("Price") * prop("Quantity")', row, columns);
   *
   * // String concatenation
   * engine.evaluate('concat(prop("First Name"), " ", prop("Last Name"))', row, columns);
   *
   * // Conditional logic
   * engine.evaluate('if(prop("Status") == "Complete", "Done", "In Progress")', row, columns);
   * ```
   */
  evaluate(formula: string, row: Row, columns: Column[]): CellValue {
    const result = this.evaluateWithResult(formula, row, columns);
    return result.value;
  }

  /**
   * Evaluate a formula and return both the result and any error
   *
   * @param formula The formula string to evaluate
   * @param row The row data containing cell values
   * @param columns The column definitions for the table
   * @returns Object containing the value and optional error message
   */
  evaluateWithResult(formula: string, row: Row, columns: Column[]): FormulaResult {
    try {
      // Parse the formula (use cache if available)
      let ast = this.astCache.get(formula);
      if (!ast) {
        ast = this.parser.parse(formula);
        this.astCache.set(formula, ast);
      }

      // Build column lookup maps
      const columnsByName = new Map<string, Column>();
      const columnsById = new Map<string, Column>();
      for (const column of columns) {
        columnsByName.set(column.name.toLowerCase(), column);
        columnsById.set(column.id, column);
      }

      // Create evaluation context
      const context: EvaluationContext = {
        row,
        columns,
        columnsByName,
        columnsById,
        depth: 0,
        maxDepth: this.options.maxDepth,
        customFunctions: this.options.customFunctions,
      };

      // Evaluate the AST
      const value = this.evaluateNode(ast, context);

      return { value: this.toCellValue(value) };
    } catch (error) {
      if (this.options.throwOnError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      return { value: null, error: message };
    }
  }

  /**
   * Validate a formula without evaluating it
   *
   * @param formula The formula string to validate
   * @returns Object with isValid flag and optional error message
   */
  validate(formula: string): { isValid: boolean; error?: string } {
    try {
      this.parser.parse(formula);
      return { isValid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isValid: false, error: message };
    }
  }

  /**
   * Get the AST for a formula (for debugging/introspection)
   *
   * @param formula The formula string to parse
   * @returns The parsed AST
   */
  getAST(formula: string): ASTNode {
    return this.parser.parse(formula);
  }

  /**
   * Clear the AST cache
   */
  clearCache(): void {
    this.astCache.clear();
  }

  /**
   * Add custom functions to the engine
   *
   * @param functions Record of function name to implementation
   */
  addFunctions(functions: Record<string, (...args: FormulaValue[]) => FormulaValue>): void {
    Object.assign(this.options.customFunctions, functions);
  }

  // ---------------------------------------------------------------------------
  // AST Evaluation
  // ---------------------------------------------------------------------------

  private evaluateNode(node: ASTNode, context: EvaluationContext): FormulaValue {
    // Check recursion depth
    if (context.depth > context.maxDepth) {
      throw new FormulaEvaluationError('Maximum evaluation depth exceeded');
    }

    const newContext = { ...context, depth: context.depth + 1 };

    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'BooleanLiteral':
        return node.value;

      case 'PropertyReference':
        return this.evaluatePropertyReference(node.propertyName, newContext);

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(
          node.operator,
          node.left,
          node.right,
          newContext
        );

      case 'UnaryExpression':
        return this.evaluateUnaryExpression(node.operator, node.operand, newContext);

      case 'FunctionCall':
        return this.evaluateFunctionCall(node.name, node.arguments, newContext);

      case 'ConditionalExpression':
        return this.evaluateConditional(
          node.condition,
          node.consequent,
          node.alternate,
          newContext
        );

      default:
        throw new FormulaEvaluationError(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }

  private evaluatePropertyReference(
    propertyName: string,
    context: EvaluationContext
  ): FormulaValue {
    // Find the column by name (case-insensitive)
    const column = context.columnsByName.get(propertyName.toLowerCase());

    if (!column) {
      throw new FormulaEvaluationError(`Property not found: "${propertyName}"`);
    }

    // Get the cell value
    const cellValue = context.row.cells[column.id];

    // Check computed values for formula/rollup columns
    if (
      (column.type === 'formula' || column.type === 'rollup') &&
      context.row.computed &&
      column.id in context.row.computed
    ) {
      return this.toFormulaValue(context.row.computed[column.id]);
    }

    return this.toFormulaValue(cellValue);
  }

  private evaluateBinaryExpression(
    operator: BinaryOperator,
    left: ASTNode,
    right: ASTNode,
    context: EvaluationContext
  ): FormulaValue {
    const leftValue = this.evaluateNode(left, context);
    const rightValue = this.evaluateNode(right, context);

    switch (operator) {
      // Arithmetic
      case '+':
        return this.evaluateAddition(leftValue, rightValue);
      case '-':
        return this.evaluateSubtraction(leftValue, rightValue);
      case '*':
        return this.evaluateMultiplication(leftValue, rightValue);
      case '/':
        return this.evaluateDivision(leftValue, rightValue);
      case '%':
        return this.evaluateModulo(leftValue, rightValue);

      // Comparison
      case '==':
        return this.evaluateEquality(leftValue, rightValue);
      case '!=':
        return !this.evaluateEquality(leftValue, rightValue);
      case '>':
        return this.evaluateComparison(leftValue, rightValue, (a, b) => a > b);
      case '<':
        return this.evaluateComparison(leftValue, rightValue, (a, b) => a < b);
      case '>=':
        return this.evaluateComparison(leftValue, rightValue, (a, b) => a >= b);
      case '<=':
        return this.evaluateComparison(leftValue, rightValue, (a, b) => a <= b);

      // Logical
      case 'and':
        return helpers.toBoolean(leftValue) && helpers.toBoolean(rightValue);
      case 'or':
        return helpers.toBoolean(leftValue) || helpers.toBoolean(rightValue);

      default:
        throw new FormulaEvaluationError(`Unknown operator: ${operator}`);
    }
  }

  private evaluateUnaryExpression(
    operator: UnaryOperator,
    operand: ASTNode,
    context: EvaluationContext
  ): FormulaValue {
    const value = this.evaluateNode(operand, context);

    switch (operator) {
      case 'not':
        return !helpers.toBoolean(value);
      case '-':
        const num = helpers.toNumber(value);
        return num === null ? null : -num;
      case '+':
        return helpers.toNumber(value);
      default:
        throw new FormulaEvaluationError(`Unknown unary operator: ${operator}`);
    }
  }

  private evaluateFunctionCall(
    name: string,
    args: ASTNode[],
    context: EvaluationContext
  ): FormulaValue {
    const lowerName = name.toLowerCase();

    // Check custom functions first
    if (lowerName in context.customFunctions) {
      const fn = context.customFunctions[lowerName];
      const evaluatedArgs = args.map((arg) => this.evaluateNode(arg, context));
      return fn(...evaluatedArgs);
    }

    // Check built-in functions
    const funcDef = getFunction(lowerName);
    if (!funcDef) {
      throw new FormulaEvaluationError(`Unknown function: ${name}`);
    }

    // Validate argument count
    if (funcDef.minArgs !== undefined && args.length < funcDef.minArgs) {
      throw new FormulaEvaluationError(
        `Function ${name} requires at least ${funcDef.minArgs} argument(s), got ${args.length}`
      );
    }
    if (funcDef.maxArgs !== undefined && args.length > funcDef.maxArgs) {
      throw new FormulaEvaluationError(
        `Function ${name} accepts at most ${funcDef.maxArgs} argument(s), got ${args.length}`
      );
    }

    // Evaluate arguments and call function
    const evaluatedArgs = args.map((arg) => this.evaluateNode(arg, context));
    return funcDef.fn(...evaluatedArgs);
  }

  private evaluateConditional(
    condition: ASTNode,
    consequent: ASTNode,
    alternate: ASTNode,
    context: EvaluationContext
  ): FormulaValue {
    const conditionValue = this.evaluateNode(condition, context);
    if (helpers.toBoolean(conditionValue)) {
      return this.evaluateNode(consequent, context);
    } else {
      return this.evaluateNode(alternate, context);
    }
  }

  // ---------------------------------------------------------------------------
  // Binary Operation Helpers
  // ---------------------------------------------------------------------------

  private evaluateAddition(left: FormulaValue, right: FormulaValue): FormulaValue {
    // String concatenation
    if (typeof left === 'string' || typeof right === 'string') {
      return helpers.toString(left) + helpers.toString(right);
    }

    // Numeric addition
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return null;
    return numLeft + numRight;
  }

  private evaluateSubtraction(left: FormulaValue, right: FormulaValue): FormulaValue {
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return null;
    return numLeft - numRight;
  }

  private evaluateMultiplication(left: FormulaValue, right: FormulaValue): FormulaValue {
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return null;
    return numLeft * numRight;
  }

  private evaluateDivision(left: FormulaValue, right: FormulaValue): FormulaValue {
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return null;
    if (numRight === 0) return null;
    return numLeft / numRight;
  }

  private evaluateModulo(left: FormulaValue, right: FormulaValue): FormulaValue {
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return null;
    if (numRight === 0) return null;
    return numLeft % numRight;
  }

  private evaluateEquality(left: FormulaValue, right: FormulaValue): boolean {
    // Handle null/undefined
    if (left === null || left === undefined) {
      return right === null || right === undefined;
    }
    if (right === null || right === undefined) {
      return false;
    }

    // Handle dates
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() === right.getTime();
    }
    if (left instanceof Date) {
      const rightDate = helpers.toDate(right);
      return rightDate !== null && left.getTime() === rightDate.getTime();
    }
    if (right instanceof Date) {
      const leftDate = helpers.toDate(left);
      return leftDate !== null && leftDate.getTime() === right.getTime();
    }

    // String comparison (case-sensitive)
    if (typeof left === 'string' && typeof right === 'string') {
      return left === right;
    }

    // Numeric comparison
    if (typeof left === 'number' || typeof right === 'number') {
      const numLeft = helpers.toNumber(left);
      const numRight = helpers.toNumber(right);
      return numLeft === numRight;
    }

    // Boolean comparison
    return left === right;
  }

  private evaluateComparison(
    left: FormulaValue,
    right: FormulaValue,
    compare: (a: number, b: number) => boolean
  ): boolean {
    // Handle dates
    if (left instanceof Date || right instanceof Date) {
      const leftDate = helpers.toDate(left);
      const rightDate = helpers.toDate(right);
      if (leftDate === null || rightDate === null) return false;
      return compare(leftDate.getTime(), rightDate.getTime());
    }

    // Numeric comparison
    const numLeft = helpers.toNumber(left);
    const numRight = helpers.toNumber(right);
    if (numLeft === null || numRight === null) return false;
    return compare(numLeft, numRight);
  }

  // ---------------------------------------------------------------------------
  // Value Conversion Helpers
  // ---------------------------------------------------------------------------

  private toFormulaValue(value: CellValue): FormulaValue {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      // Handle multi_select, file references, relations
      return value.join(', ');
    }
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return helpers.toString(value);
  }

  private toCellValue(value: FormulaValue): CellValue {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return helpers.toString(value);
  }
}

/**
 * Create a default FormulaEngine instance
 */
export function createFormulaEngine(options?: FormulaEngineOptions): FormulaEngine {
  return new FormulaEngine(options);
}
