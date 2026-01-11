/**
 * Formula Parser for Notion-like data table
 *
 * Parses formula strings into an Abstract Syntax Tree (AST)
 * using a recursive descent parser.
 */

// =============================================================================
// AST Node Types
// =============================================================================

/**
 * Base type for all AST nodes
 */
export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | PropertyReference
  | BinaryExpression
  | UnaryExpression
  | FunctionCall
  | ConditionalExpression;

/**
 * Numeric literal (e.g., 42, 3.14)
 */
export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

/**
 * String literal (e.g., "hello", 'world')
 */
export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

/**
 * Boolean literal (true, false)
 */
export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

/**
 * Property reference (e.g., prop("Column Name"))
 */
export interface PropertyReference {
  type: 'PropertyReference';
  propertyName: string;
}

/**
 * Binary expression (e.g., a + b, x == y)
 */
export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

/**
 * Unary expression (e.g., not x, -5)
 */
export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  operand: ASTNode;
}

/**
 * Function call (e.g., add(1, 2), concat("a", "b"))
 */
export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  arguments: ASTNode[];
}

/**
 * Conditional expression for ternary operations
 */
export interface ConditionalExpression {
  type: 'ConditionalExpression';
  condition: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

/**
 * Binary operators
 */
export type BinaryOperator =
  // Arithmetic
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  // Comparison
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  // Logical
  | 'and'
  | 'or';

/**
 * Unary operators
 */
export type UnaryOperator = 'not' | '-' | '+';

// =============================================================================
// Token Types
// =============================================================================

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'IDENTIFIER'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'QUESTION'
  | 'COLON'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string | number | boolean;
  position: number;
}

// =============================================================================
// Lexer (Tokenizer)
// =============================================================================

/**
 * Tokenizes a formula string into an array of tokens
 */
class Lexer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenize the entire input string
   */
  tokenize(): Token[] {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      // String literals
      if (char === '"' || char === "'") {
        this.readString(char);
        continue;
      }

      // Numbers
      if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1)))) {
        this.readNumber();
        continue;
      }

      // Identifiers and keywords
      if (this.isAlpha(char) || char === '_') {
        this.readIdentifier();
        continue;
      }

      // Operators and punctuation
      this.readOperator();
    }

    this.tokens.push({ type: 'EOF', value: '', position: this.position });
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isAlphanumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private peek(offset: number = 0): string {
    return this.input[this.position + offset] || '';
  }

  private readString(quote: string): void {
    const start = this.position;
    this.position++; // Skip opening quote
    let value = '';

    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        // Handle escape sequences
        this.position++;
        const escaped = this.input[this.position];
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escaped;
        }
      } else {
        value += this.input[this.position];
      }
      this.position++;
    }

    if (this.position >= this.input.length) {
      throw new FormulaParseError(`Unterminated string literal`, start);
    }

    this.position++; // Skip closing quote
    this.tokens.push({ type: 'STRING', value, position: start });
  }

  private readNumber(): void {
    const start = this.position;
    let numStr = '';
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (this.isDigit(char)) {
        numStr += char;
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        numStr += char;
        this.position++;
      } else {
        break;
      }
    }

    // Handle scientific notation (e.g., 1e10, 2.5e-3)
    if (this.peek() === 'e' || this.peek() === 'E') {
      numStr += this.input[this.position++];
      if (this.peek() === '+' || this.peek() === '-') {
        numStr += this.input[this.position++];
      }
      while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
        numStr += this.input[this.position++];
      }
    }

    this.tokens.push({ type: 'NUMBER', value: parseFloat(numStr), position: start });
  }

  private readIdentifier(): void {
    const start = this.position;
    let name = '';

    while (this.position < this.input.length && this.isAlphanumeric(this.input[this.position])) {
      name += this.input[this.position];
      this.position++;
    }

    const lowerName = name.toLowerCase();

    // Check for keywords
    if (lowerName === 'true') {
      this.tokens.push({ type: 'BOOLEAN', value: true, position: start });
    } else if (lowerName === 'false') {
      this.tokens.push({ type: 'BOOLEAN', value: false, position: start });
    } else if (lowerName === 'and') {
      this.tokens.push({ type: 'AND', value: 'and', position: start });
    } else if (lowerName === 'or') {
      this.tokens.push({ type: 'OR', value: 'or', position: start });
    } else if (lowerName === 'not') {
      this.tokens.push({ type: 'NOT', value: 'not', position: start });
    } else {
      this.tokens.push({ type: 'IDENTIFIER', value: name, position: start });
    }
  }

  private readOperator(): void {
    const start = this.position;
    const char = this.input[this.position];
    const next = this.peek(1);

    // Two-character operators
    if (char === '=' && next === '=') {
      this.tokens.push({ type: 'EQ', value: '==', position: start });
      this.position += 2;
      return;
    }
    if (char === '!' && next === '=') {
      this.tokens.push({ type: 'NEQ', value: '!=', position: start });
      this.position += 2;
      return;
    }
    if (char === '>' && next === '=') {
      this.tokens.push({ type: 'GTE', value: '>=', position: start });
      this.position += 2;
      return;
    }
    if (char === '<' && next === '=') {
      this.tokens.push({ type: 'LTE', value: '<=', position: start });
      this.position += 2;
      return;
    }
    if (char === '&' && next === '&') {
      this.tokens.push({ type: 'AND', value: 'and', position: start });
      this.position += 2;
      return;
    }
    if (char === '|' && next === '|') {
      this.tokens.push({ type: 'OR', value: 'or', position: start });
      this.position += 2;
      return;
    }

    // Single-character operators
    const singleCharTokens: Record<string, TokenType> = {
      '(': 'LPAREN',
      ')': 'RPAREN',
      ',': 'COMMA',
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'STAR',
      '/': 'SLASH',
      '%': 'PERCENT',
      '>': 'GT',
      '<': 'LT',
      '?': 'QUESTION',
      ':': 'COLON',
      '!': 'NOT',
    };

    if (singleCharTokens[char]) {
      this.tokens.push({ type: singleCharTokens[char], value: char, position: start });
      this.position++;
      return;
    }

    throw new FormulaParseError(`Unexpected character: ${char}`, start);
  }
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Error thrown when parsing fails
 */
export class FormulaParseError extends Error {
  public position: number;

  constructor(message: string, position: number) {
    super(`Formula parse error at position ${position}: ${message}`);
    this.name = 'FormulaParseError';
    this.position = position;
  }
}

/**
 * Parses formula strings into an AST using recursive descent parsing
 */
export class FormulaParser {
  private tokens: Token[] = [];
  private current: number = 0;

  /**
   * Parse a formula string into an AST
   * @param formula The formula string to parse
   * @returns The root AST node
   * @throws FormulaParseError if parsing fails
   */
  parse(formula: string): ASTNode {
    if (!formula || formula.trim() === '') {
      throw new FormulaParseError('Empty formula', 0);
    }

    const lexer = new Lexer(formula);
    this.tokens = lexer.tokenize();
    this.current = 0;

    const ast = this.parseExpression();

    if (!this.isAtEnd()) {
      throw new FormulaParseError(
        `Unexpected token: ${this.peek().value}`,
        this.peek().position
      );
    }

    return ast;
  }

  // ---------------------------------------------------------------------------
  // Expression Parsing (Precedence Climbing)
  // ---------------------------------------------------------------------------

  private parseExpression(): ASTNode {
    return this.parseTernary();
  }

  private parseTernary(): ASTNode {
    let expr = this.parseOr();

    if (this.match('QUESTION')) {
      const consequent = this.parseExpression();
      this.consume('COLON', 'Expected ":" in ternary expression');
      const alternate = this.parseTernary();
      expr = {
        type: 'ConditionalExpression',
        condition: expr,
        consequent,
        alternate,
      };
    }

    return expr;
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.match('OR')) {
      const right = this.parseAnd();
      left = {
        type: 'BinaryExpression',
        operator: 'or',
        left,
        right,
      };
    }

    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality();

    while (this.match('AND')) {
      const right = this.parseEquality();
      left = {
        type: 'BinaryExpression',
        operator: 'and',
        left,
        right,
      };
    }

    return left;
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison();

    while (this.check('EQ') || this.check('NEQ')) {
      const operator = this.advance().value as '==' | '!=';
      const right = this.parseComparison();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();

    while (this.check('GT') || this.check('LT') || this.check('GTE') || this.check('LTE')) {
      const operator = this.advance().value as '>' | '<' | '>=' | '<=';
      const right = this.parseAdditive();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.check('PLUS') || this.check('MINUS')) {
      const operator = this.advance().value as '+' | '-';
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();

    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      const tokenValue = this.advance().value as string;
      const operator = tokenValue === '*' ? '*' : tokenValue === '/' ? '/' : '%';
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseUnary(): ASTNode {
    if (this.match('NOT')) {
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: 'not',
        operand,
      };
    }

    if (this.match('MINUS')) {
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: '-',
        operand,
      };
    }

    if (this.match('PLUS')) {
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: '+',
        operand,
      };
    }

    return this.parseCall();
  }

  private parseCall(): ASTNode {
    let expr = this.parsePrimary();

    // Function calls are handled in parsePrimary for identifiers
    return expr;
  }

  private parsePrimary(): ASTNode {
    // Number literal
    if (this.check('NUMBER')) {
      const token = this.advance();
      return {
        type: 'NumberLiteral',
        value: token.value as number,
      };
    }

    // String literal
    if (this.check('STRING')) {
      const token = this.advance();
      return {
        type: 'StringLiteral',
        value: token.value as string,
      };
    }

    // Boolean literal
    if (this.check('BOOLEAN')) {
      const token = this.advance();
      return {
        type: 'BooleanLiteral',
        value: token.value as boolean,
      };
    }

    // Identifier (function call or property reference)
    if (this.check('IDENTIFIER')) {
      const nameToken = this.advance();
      const name = nameToken.value as string;

      // Check if this is a function call
      if (this.match('LPAREN')) {
        const args = this.parseArguments();
        this.consume('RPAREN', 'Expected ")" after function arguments');

        // Special handling for prop() function
        if (name.toLowerCase() === 'prop') {
          if (args.length !== 1 || args[0].type !== 'StringLiteral') {
            throw new FormulaParseError(
              'prop() requires exactly one string argument',
              nameToken.position
            );
          }
          return {
            type: 'PropertyReference',
            propertyName: (args[0] as StringLiteral).value,
          };
        }

        return {
          type: 'FunctionCall',
          name: name.toLowerCase(),
          arguments: args,
        };
      }

      // Bare identifier - could be a constant or error
      throw new FormulaParseError(
        `Unexpected identifier "${name}". Did you mean to call a function?`,
        nameToken.position
      );
    }

    // Grouped expression
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', 'Expected ")" after expression');
      return expr;
    }

    throw new FormulaParseError(
      `Unexpected token: ${this.peek().value}`,
      this.peek().position
    );
  }

  private parseArguments(): ASTNode[] {
    const args: ASTNode[] = [];

    if (!this.check('RPAREN')) {
      do {
        args.push(this.parseExpression());
      } while (this.match('COMMA'));
    }

    return args;
  }

  // ---------------------------------------------------------------------------
  // Token Helpers
  // ---------------------------------------------------------------------------

  private peek(): Token {
    return this.tokens[this.current];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new FormulaParseError(message, this.peek().position);
  }
}
