import type { Scanner } from '../structure/scanner';
import { TokenOption } from '../types/interfaces';

enum Tokens {
  ERROR,
  Identifier, String, Number,
  Write, LessThan, LessOrEqual, Equal, Inequal, GreaterThan, GreaterOrEqual, Assign, Declare,
  Plus, Minus, Multiply, Divide, Colon, Swap,
  LeftSquareBracket, RightSquareBracket,
  LeftCurlyBracket, RightCurlyBracket,
  LeftBracket, RightBracket,
  Question, Arrow, Comma, Bar, Dollar, Import,
  Comments,

  MAX_TERMINAL_TOKEN,

  Include, Statement, Declaration, Assignment,
  If, Else, Loop, Print, Function, Expression, Condition,
  Term, Factor, LoopHead, IfHead,
  MAX_TOKEN
}

const statementFollow = [Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Arrow, Tokens.Import, Tokens.RightBracket]
const expressionFollow = [...statementFollow, Tokens.RightSquareBracket, Tokens.RightCurlyBracket, Tokens.Comma, Tokens.LessThan, Tokens.LessOrEqual, Tokens.Equal, Tokens.Inequal, Tokens.GreaterThan, Tokens.GreaterOrEqual];
const termFollow = [ Tokens.Plus, Tokens.Minus, ...expressionFollow ];
const factorFollow = [ Tokens.Multiply, Tokens.Divide, ...termFollow ];

const followTokenSet = {
  [`${Tokens.Include}`]: statementFollow,
  [`${Tokens.Statement}`]: statementFollow,
  [`${Tokens.Declaration}`]: statementFollow,
  [`${Tokens.Assignment}`]: statementFollow,
  [`${Tokens.If}`]: statementFollow,
  [`${Tokens.Else}`]: statementFollow,
  [`${Tokens.Print}`]: statementFollow,

  [`${Tokens.IfHead}`]: [Tokens.LeftBracket],
  [`${Tokens.Loop}`]: statementFollow,
  [`${Tokens.LoopHead}`]: [Tokens.RightSquareBracket],

  [`${Tokens.Expression}`]: expressionFollow,
  [`${Tokens.Condition}`]: [Tokens.RightCurlyBracket],
  [`${Tokens.Term}`]: termFollow,
  [`${Tokens.Factor}`]: factorFollow,

  [`${Tokens.Function}`]: factorFollow
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
      this.right = scanner.getSource()[this.left-1]?.length;
    }
    this.value = value;
  }

  public toString(): string {
    return `Id = ${this.token}; Left = ${this.left}; Right = ${this.right}; Value = ${this.value};`;
  }
}

export { Tokens, Token, followTokenSet }
