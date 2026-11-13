import { Errors } from '../constant/errors';
import { booleanOperators, followTokenSet, Token, Tokens } from '../constant/token';
import type { FunctionDeclaration } from './function';
import type { Identifier } from './identifier';

type CustomFunctionArgument = {
  expression: ExpressionNode;
  byReference: boolean;
};

type ExpressionNode =
  | { type: 'Error'; error: Errors, token: Token | null }
  | { type: 'Atom'; code: string; assignable: boolean; isReference: boolean; token: Token }
  | { type: 'Unary'; operator: string; operand: ExpressionNode;  }
  | { type: 'Binary'; operator: Tokens; left: ExpressionNode; right: ExpressionNode; }
  | { type: 'Assignment'; left: ExpressionNode; right: ExpressionNode; }
  | { type: 'ModuleFunction'; name: Token; args: ExpressionNode[]; }
  | { type: 'CustomFunction'; name: Token; generatedName: string; args: CustomFunctionArgument[] };

export interface ExpressionParserContext {
  current(): Token | null;
  peek(): Token | null;
  advance(): void;
  report(error: Errors, token: Token | null): void;
  recover(nonterminal: Tokens): void;
  getIdentifier(name: string): Identifier | undefined;
  isModuleFunctionDisabled(name: Token): boolean;
  getFunction(name: string, arity: number): FunctionDeclaration | undefined;
  hasFunction(name: string): boolean;
}

class ExpressionParser {
  constructor(private readonly context: ExpressionParserContext) {}

  public parse(): string {
    const expression = this.parseAssignment();
    return this.buildCode(expression);
  }

  private parseAssignment(): ExpressionNode {
    const left = this.parseLogicalOr();

    if (!this.nowTokenIs(Tokens.Assign)) {
      return left;
    }

    const operator = this.context.current()!;
    this.context.advance();

    if (left.type !== 'Atom' || !left.assignable) {
      this.context.report(Errors.InvalidAssignmentTarget, operator);
    }

    const right = this.parseAssignment();

    return { type: 'Assignment', left, right };
  }

  private parseLogicalOr(): ExpressionNode {
    return this.parseBinary(
      () => this.parseLogicalAnd(),
      [Tokens.LogicalOr]
    );
  }

  private parseLogicalAnd(): ExpressionNode {
    return this.parseBinary(
      () => this.parseEquality(),
      [Tokens.LogicalAnd]
    );
  }

  private parseEquality(): ExpressionNode {
    return this.parseBinary(
      () => this.parseRelational(),
      [Tokens.Equal, Tokens.Inequal]
    );
  }

  private parseRelational(): ExpressionNode {
    return this.parseBinary(
      () => this.parseAdditive(),
      [Tokens.LessThan, Tokens.LessOrEqual, Tokens.GreaterThan, Tokens.GreaterOrEqual]
    );
  }

  private parseAdditive(): ExpressionNode {
    return this.parseBinary(
      () => this.parseMultiplicative(),
      [Tokens.Plus, Tokens.Minus]
    );
  }

  private parseMultiplicative(): ExpressionNode {
    return this.parseBinary(
      () => this.parseUnary(),
      [Tokens.Multiply, Tokens.Divide, Tokens.Modulo]
    );
  }

  private parseUnary(): ExpressionNode {
    if (this.nowTokenIs(Tokens.Plus, Tokens.Minus)) {
      const operator = this.context.current()!;
      this.context.advance();
      return { type: 'Unary', operator: operator.value, operand: this.parseUnary() };
    }

    return this.parsePower();
  }

  private parsePower(): ExpressionNode {
    const left = this.parsePrimary();

    if (!this.nowTokenIs(Tokens.Power)) {
      return left;
    }

    this.context.advance();

    return { type: 'Binary', operator: Tokens.Power, left, right: this.parseUnary() };
  }

  private parsePrimary(): ExpressionNode {
    if (this.nowTokenIs(Tokens.Dollar)) {
      return this.parseCustomFunction();
    }

    if (this.nowTokenIs(Tokens.Identifier)) {
      if (this.context.peek()?.token === Tokens.LeftBracket) {
        return this.parseModuleFunction();
      }

      return this.parseIdentifier();
    }

    if (this.nowTokenIs(Tokens.Number)) {
      return this.parseNumber();
    }

    if (this.nowTokenIs(Tokens.LeftBracket)) {
      return this.parseParenthesis();
    }

    const token = this.context.current();

    this.context.report(Errors.MissingExpression, token);

    if (token && !this.isExpressionBoundary(token.token)) {
      this.context.advance();
    }

    return { type: 'Error', error: Errors.MissingExpression, token: token };
  }

  private parseParenthesis(): ExpressionNode {
    this.context.advance();

    const expression = this.parseAssignment();

    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.context.advance();
    } else {
      this.context.report(
        Errors.MissingRightBracket,
        this.context.current()
      );

      this.context.recover(Tokens.Expression);
    }

    return expression;
  }

  private getExpressionToken(expression: ExpressionNode): Token | null {
    switch (expression.type) {
      case 'Atom':
        return expression.token;

      case 'Unary':
        return this.getExpressionToken(expression.operand);

      case 'Binary':
        return this.getExpressionToken(expression.left);

      case 'Assignment':
        return this.getExpressionToken(expression.left);

      case 'ModuleFunction':
        return expression.name;

      case 'CustomFunction':
        return expression.name;

      case 'Error':
        return expression.token;
    }
  }

  private parseCustomFunction(): ExpressionNode {
    this.context.advance();

    // 必須接識別字
    if (!this.nowTokenIs(Tokens.Identifier)) {
      this.context.report(Errors.MissingIdentifier, this.context.current());
      this.context.recover(Tokens.FunctionCall);
      return { type: 'Error', error: Errors.MissingIdentifier, token: this.context.current() };
    }

    const name = this.context.current()!;
    this.context.advance();

    if (!this.nowTokenIs(Tokens.LeftBracket)) {
      this.context.report(Errors.MissingLeftBracket, this.context.current());
      this.context.recover(Tokens.FunctionCall);
      return { type: 'Error', error: Errors.MissingLeftBracket, token: this.context.current() };
    }

    // 吃掉左括號
    this.context.advance();

    // 解析參數
    const args: ExpressionNode[] = [];

    if (!this.nowTokenIs(Tokens.RightBracket)) {
      args.push(this.parseArgument());

      while (this.nowTokenIs(Tokens.Comma)) {
        this.context.advance();

        args.push(this.parseArgument());
      }
    }

    // 檢查右括號
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.context.advance();
    } else {
      this.context.report(
        Errors.MissingRightBracket,
        this.context.current()
      );

      this.context.recover(Tokens.FunctionCall);
    }

    // 根據函式名稱及參數數量查找函式
    const declaration = this.context.getFunction(name.value, args.length);

    // 找不到符合的函式
    if (!declaration) {
      const error = this.context.hasFunction(name.value)
        ? Errors.OverloadNotFound
        : Errors.FunctionNotDefined;
      this.context.report(error, name);
      return { type: 'Error', error: error, token: name };
    }

    // 依照函式宣告中的 byReference 決定參數轉換方式
    const compiledArgs = args.map((argument, index) => {
      const byReference = declaration.parameters[index]!.byReference;

      if (byReference && (argument.type !== 'Atom' || !argument.assignable)) {
        this.context.report(Errors.InvalidReferenceArgument, this.getExpressionToken(argument) ?? name);
      }
      return { expression: argument, byReference };
    });

    return {
      type: 'CustomFunction',
      name,
      generatedName: declaration.generatedName,
      args: compiledArgs
    };
  }

  private parseModuleFunction(): ExpressionNode {
    const name = this.context.current()!;

    if (this.context.isModuleFunctionDisabled(name)) {
      this.context.report(Errors.UseDisabledModuleFunction, name);
      this.context.recover(Tokens.ModuleFunction);
      return { type: 'Error', error: Errors.UseDisabledModuleFunction, token: name };
    }

    this.context.advance();

    if (!this.nowTokenIs(Tokens.LeftBracket)) {
      this.context.report(Errors.MissingLeftBracket, this.context.current());
      this.context.recover(Tokens.ModuleFunction);
      return { type: 'Error', error: Errors.MissingLeftBracket, token: this.context.current() };
    }

    this.context.advance();

    const args: ExpressionNode[] = [];

    if (!this.nowTokenIs(Tokens.RightBracket)) {
      args.push(this.parseArgument());

      while (this.nowTokenIs(Tokens.Comma)) {
        this.context.advance();
        args.push(this.parseArgument());
      }
    }

    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.context.advance();
    } else {
      this.context.report(Errors.MissingRightBracket, this.context.current());
      this.context.recover(Tokens.ModuleFunction);
    }

    return { type: 'ModuleFunction', name, args };
  }

  private parseArgument(): ExpressionNode {
    const token = this.context.current();

    if (token?.token === Tokens.String) {
      this.context.advance();
      return { type: 'Atom', code: token.value, assignable: false, isReference: false, token };
    }

    return this.parseAssignment();
  }

  private parseIdentifier(): ExpressionNode {
    const token = this.context.current()!;
    const identifier = this.context.getIdentifier(token.value);

    this.context.advance();

    if (!identifier) {
      this.context.report(Errors.IdentifierNotDefined, token);
      return { type: 'Error', error: Errors.IdentifierNotDefined, token: token };
    }

    return { type: 'Atom', code: identifier.generatedName, assignable: true, isReference: identifier.byReference, token };
  }

  private parseNumber(): ExpressionNode {
    const token = this.context.current()!;
    this.context.advance();
    return { type: 'Atom', code: Number(token.value).toString(), assignable: false, isReference: false, token };
  }

  private parseBinary(next: () => ExpressionNode, operators: Tokens[]): ExpressionNode {
    let left = next();

    while (this.nowTokenIs(...operators)) {
      const operator = this.context.current()!;
      this.context.advance();

      const right = next();

      left = { type: 'Binary', operator: operator.token, left, right };
    }

    return left;
  }

  private buildCode(
    expression: ExpressionNode,
    parentPrecedence = 0,
    parentOperator?: Tokens | 'Assignment' | 'Unary',
    side?: 'left' | 'right'
  ): string {
    const precedence = this.expressionPrecedence(expression);
    let code = '';

    switch (expression.type) {
      case 'Error':
        code = 'undefined';
        break;

      case 'Atom':
        code = expression.isReference ? `${expression.code}._ref` : expression.code
        break;

      case 'Unary': {
        const operand = this.buildCode(expression.operand, 14, 'Unary', 'right');
        code = ` ${expression.operator}${operand}`;
        break;
      }

      case 'Assignment': {
        const left = this.buildCode(expression.left, 2, 'Assignment', 'left');
        const right = this.buildCode(expression.right, 2, 'Assignment', 'right');
        code = `${left}=${right}`;
        break;
      }

      case 'Binary':
        code = this.buildBinary(expression);
        break;

      case 'ModuleFunction': {
        const args = expression.args.map(arg => this.buildCode(arg)).join(',');
        code = `__hzs_invoke("${expression.name.value}"${args ? `,${args}` : ''})`;
        break;
      }

      case 'CustomFunction': {
        const args = expression.args.map(({ expression: argument, byReference }) => {
          if (!byReference) return this.buildCode(argument);
          if (argument.type !== 'Atom' || !argument.assignable) return 'undefined';
          if (argument.isReference) return argument.code;

          const target = argument.code;
          return `{get _ref(){return ${target};},set _ref(v){return ${target}=v;}}`;
        });
        code = `${expression.generatedName}(${args.join(',')})`;
        break;
      }
    }

    return this.shouldParenthesize(expression, precedence, parentPrecedence, parentOperator, side) ? `(${code})` : code;
  }

  private buildBinary(expression: Extract<ExpressionNode, { type: 'Binary' }>): string {
    const operator = expression.operator;
    const precedence = this.operatorPrecedence(operator);

    const left = this.buildCode(expression.left, precedence, operator, 'left');
    const right = this.buildCode(expression.right, precedence, operator, 'right');

    if (operator === Tokens.LogicalAnd || operator === Tokens.LogicalOr) {
      const value = this.operatorValue(operator);
      return `Number(!!(${left}${value}${right}))`;
    }

    if (operator === Tokens.Equal || operator === Tokens.Inequal ||
        operator === Tokens.LessThan || operator === Tokens.LessOrEqual ||
        operator === Tokens.GreaterThan || operator === Tokens.GreaterOrEqual) {
      const value = this.operatorValue(operator);
      return `Number(${left}${value}${right})`;
    }

    if (operator === Tokens.Power) {
      return `${left}**${right}`;
    }

    return `${left}${this.operatorValue(operator)}${right}`;
  }


  private operatorValue(operator: Tokens): string {
    switch (operator) {
      case Tokens.Equal: return '==';
      case Tokens.Inequal: return '!=';
      case Tokens.LessThan: return '<';
      case Tokens.LessOrEqual: return '<=';
      case Tokens.GreaterThan: return '>';
      case Tokens.GreaterOrEqual: return '>=';
      case Tokens.Plus: return '+';
      case Tokens.Minus: return '-';
      case Tokens.Multiply: return '*';
      case Tokens.Divide: return '/';
      case Tokens.Modulo: return '%';
      case Tokens.LogicalAnd: return '&&';
      case Tokens.LogicalOr: return '||';
      default: return '';
    }
  }

  private nowTokenIs(...tokens: Tokens[]): boolean {
    return tokens.includes(
      this.context.current()?.token as Tokens
    );
  }

  private shouldParenthesize(
    expression: ExpressionNode,
    precedence: number,
    parentPrecedence: number,
    parentOperator?: Tokens | 'Assignment' | 'Unary',
    side?: 'left' | 'right'
  ): boolean {
    if (parentPrecedence === 0) return false

    // Unary 的運算元需要特殊處理
    if (parentOperator === 'Unary') {
      // JavaScript 不允許 Unary Expression 作為 Power 的左運算元
      if (expression.type === 'Binary' && expression.operator === Tokens.Power) return true;
      // Unary 是右結合，不需要包住另一個 Unary
      return precedence < parentPrecedence;
    }

    // Power 的右側允許 Unary Expression
    if (parentOperator === Tokens.Power && side === 'right' && expression.type === 'Unary') return false;

    if (precedence < parentPrecedence) return true;
    if (precedence > parentPrecedence) return false;

    // Power 和 Assignment 都是右結合
    if (parentOperator === Tokens.Power || parentOperator === 'Assignment') {
      return side === 'left';
    }

    // 其他 Binary Operator 都是左結合
    return side === 'right';
  }

  private expressionPrecedence(expression: ExpressionNode): number {
    switch (expression.type) {
      case 'Atom':
      case 'Error': 
      case 'ModuleFunction':
      case 'CustomFunction':
        return 100;

      case 'Unary':
        return 14;

      case 'Assignment':
        return 2;

      case 'Binary':
        return this.isBooleanOperator(expression.operator) ? 100 : this.operatorPrecedence(expression.operator);
    }
  }

  private operatorPrecedence(operator: Tokens): number {
    switch (operator) {
      case Tokens.LogicalOr: return 4;
      case Tokens.LogicalAnd: return 5;

      case Tokens.Equal:
      case Tokens.Inequal:
        return 8;

      case Tokens.LessThan:
      case Tokens.LessOrEqual:
      case Tokens.GreaterThan:
      case Tokens.GreaterOrEqual:
        return 9;

      case Tokens.Plus:
      case Tokens.Minus:
        return 11;

      case Tokens.Multiply:
      case Tokens.Divide:
      case Tokens.Modulo:
        return 12;

      case Tokens.Power:
        return 15;

      default:
        return 0;
    }
  }

  private isBooleanOperator(operator: Tokens): boolean {
    return booleanOperators.includes(operator);
  }

  private isExpressionBoundary(token: Tokens): boolean {
    return followTokenSet[Tokens.Expression]!.includes(token);
  }
}

export { ExpressionParser };
