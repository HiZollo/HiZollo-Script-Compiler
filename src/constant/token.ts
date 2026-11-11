import type { Scanner } from '../structure/scanner';
import type { TokenOption } from '../types/interfaces';

enum Tokens {
  ERROR,
  Identifier, String, Number,
  Write, LessThan, LessOrEqual, Equal, Inequal, GreaterThan, GreaterOrEqual, Assign, Declare,
  Plus, Minus, Multiply, Divide, 
  Modulo, Power, LogicalAnd, LogicalOr,
  Colon, Swap,
  LeftSquareBracket, RightSquareBracket,
  LeftCurlyBracket, RightCurlyBracket,
  LeftBracket, RightBracket,
  Question, Arrow, At, Comma, Bar, Dollar, Import, ReturnArrow,
  Comments,

  MAX_TERMINAL_TOKEN,

  Include, Statement, Declaration,
  If, Else, Loop, Print, ModuleFunction, Expression,
  LoopHead, IfHead,
  FunctionDeclarationParameter, FunctionDeclaration, FunctionCall, ReturnStatement,
  MAX_TOKEN
}

const statementBeginning = [Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Arrow, Tokens.Import, Tokens.Dollar, Tokens.Number];
const statementFollow = [...statementBeginning, Tokens.RightBracket];
const expressionFollow = [...statementFollow, Tokens.RightSquareBracket, Tokens.RightCurlyBracket, Tokens.Comma];
const booleanOperators = [Tokens.LogicalAnd, Tokens.LogicalOr, Tokens.Equal, Tokens.Inequal, Tokens.LessThan, Tokens.LessOrEqual, Tokens.GreaterThan, Tokens.GreaterOrEqual];
const expressionOperators = [Tokens.Assign, Tokens.Plus, Tokens.Minus, Tokens.Multiply, Tokens.Divide, Tokens.Modulo, Tokens.Power, ...booleanOperators];
const primaryExpressionFollow = [...expressionFollow, ...expressionOperators]

const followTokenSet: Partial<Record<Tokens, Tokens[]>> = {
  [`${Tokens.Include}`]: statementFollow,
  [`${Tokens.Statement}`]: statementFollow,
  [`${Tokens.Declaration}`]: statementFollow,
  [`${Tokens.If}`]: statementFollow,
  [`${Tokens.Else}`]: statementFollow,
  [`${Tokens.Print}`]: statementFollow,

  [`${Tokens.IfHead}`]: [Tokens.LeftBracket],
  [`${Tokens.Loop}`]: statementFollow,
  [`${Tokens.LoopHead}`]: [Tokens.RightSquareBracket],

  [`${Tokens.Expression}`]: expressionFollow,
  [`${Tokens.ModuleFunction}`]: primaryExpressionFollow,
  [`${Tokens.FunctionCall}`]: primaryExpressionFollow,

  [`${Tokens.FunctionDeclaration}`]: statementFollow,
  [`${Tokens.FunctionDeclarationParameter}`]: [Tokens.RightBracket, Tokens.LeftBracket],
  [`${Tokens.ReturnStatement}`]: statementFollow,

};

class Token {
  public token: Tokens;
  public left: number;
  public right: number;
  public value: string;
  constructor(scanner: Scanner, { token, left, right, value }: TokenOption) {
    this.token = token;
    this.left = left;
    this.right = right;

    while (!this.right) {
      this.left--;
      const previousLine = scanner.getSource()[this.left-1];
      if (previousLine === undefined) throw new Error("TOKEN_POSITION_CALCULATION_FAILED")

      this.right = previousLine.length
    }
    this.value = value;
  }

  public toString(): string {
    return `Id = ${this.token}; Left = ${this.left}; Right = ${this.right}; Value = ${this.value};`;
  }
}

export { Tokens, Token, followTokenSet, statementBeginning, booleanOperators }
