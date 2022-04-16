import type { Scanner } from '../structure/scanner';

enum Tokens {
  ERROR,
  Identifier, String, Number,
  Write, LessThan, LessOrEqual, Equal, Inequal, GreaterThan, GreaterOrEqual, Assign, Declare,
  Plus, Minus, Multiply, Divide, Colon,
  LeftSquareBracket, RightSquareBracket,
  LeftCurlyBracket, RightCurlyBracket,
  LeftBracket, RightBracket,
  Question, Arrow, Comma, Import,

  MAX_TERMINAL_TOKEN,

  Include, Statement, Declaration, Assignment,
  If, Else, For, Print, Function, Expression, Condition,
  Term, Factor, ForHead, IfHead,
  MAX_TOKEN
}
type TokenConstruct = {
  token: Tokens,
  left: number,
  right: number,
  value: string
}

const followTokenSet = {
  [`${Tokens.Include}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.Statement}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.Declaration}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.Assignment}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.For}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.Print}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write],
  [`${Tokens.Function}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Multiply, Tokens.Divide],
  [`${Tokens.Expression}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.RightCurlyBracket, Tokens.RightSquareBracket, Tokens.Arrow, Tokens.Comma, Tokens.RightBracket, Tokens.GreaterThan, Tokens.GreaterOrEqual, Tokens.Equal, Tokens.LessThan, Tokens.LessOrEqual],
  [`${Tokens.Condition}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.RightCurlyBracket, Tokens.RightSquareBracket, Tokens.Arrow, Tokens.Comma, Tokens.RightBracket, Tokens.GreaterThan, Tokens.GreaterOrEqual, Tokens.Equal, Tokens.LessThan, Tokens.LessOrEqual],
  [`${Tokens.Term}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.RightCurlyBracket, Tokens.RightSquareBracket, Tokens.Arrow, Tokens.Comma, Tokens.RightBracket, Tokens.GreaterThan, Tokens.GreaterOrEqual, Tokens.Equal, Tokens.LessThan, Tokens.LessOrEqual],
  [`${Tokens.Factor}`]: [Tokens.Import, Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.RightCurlyBracket, Tokens.RightSquareBracket, Tokens.Arrow, Tokens.Comma, Tokens.RightBracket, Tokens.GreaterThan, Tokens.GreaterOrEqual, Tokens.Equal, Tokens.LessThan, Tokens.LessOrEqual],
  [`${Tokens.ForHead}`]: [Tokens.LeftBracket],
  [`${Tokens.If}`]: [Tokens.Identifier, Tokens.RightCurlyBracket, Tokens.RightSquareBracket, Tokens.Colon],
  [`${Tokens.IfHead}`]: [Tokens.Question],
  [`${Tokens.Else}`]: [Tokens.Identifier, Tokens.RightCurlyBracket, Tokens.RightSquareBracket]
}

class Token {
  public token: Tokens;
  public left: number;
  public right: number;
  public value: string;
  constructor(scanner: Scanner, { token, left, right, value }: TokenConstruct) {
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
