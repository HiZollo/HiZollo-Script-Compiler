import type { Parser } from '../structure/parser';
import type { Token, Tokens } from './token';
import { followTokenSet } from './token';
import { TranslateMap } from '../types/interfaces';

enum Errors {
  UnknownStatement,
  UnknownIdentifier,
  CantImportCoreModule,
  AlreadyImported,
  LateImport,
  MissingModuleName,
  ModuleNotFound,
  MissingIdentifier,
  IdentifierNotDefined,
  RedeclareIdentifier,
  MissingNumber,
  MissingString,
  MissingLeftBracket,
  MissingRightBracket,
  MissingRightSquareBracket,
  MissingRightCurlyBracket,
  MissingAssignOperator,
  MissingArrow,
  InvalidComparation,
  InappropriateBreakStatement,
  UseDisabledFunction
}

const errorToString: TranslateMap = {
  [`${Errors.UnknownStatement}`]: "未知敘述",
  [`${Errors.UnknownIdentifier}`]: "未知用途識別字",
  [`${Errors.CantImportCoreModule}`]: "不能手動引入核心模組",
  [`${Errors.AlreadyImported}`]: "已經引入此模組",
  [`${Errors.LateImport}`]: "匯入敘述應該放在程式開頭",
  [`${Errors.MissingModuleName}`]: "遺漏模組名稱",
  [`${Errors.ModuleNotFound}`]: "找不到模組",
  [`${Errors.MissingNumber}`]: "遺漏數字",
  [`${Errors.MissingString}`]: "遺漏字串",
  [`${Errors.MissingIdentifier}`]: "遺漏識別字",
  [`${Errors.IdentifierNotDefined}`]: "變數未宣告",
  [`${Errors.RedeclareIdentifier}`]: "變數重複宣告",
  [`${Errors.MissingLeftBracket}`]: "遺漏左括號",
  [`${Errors.MissingRightBracket}`]: "遺漏右括號",
  [`${Errors.MissingRightSquareBracket}`]: "遺漏右中括號",
  [`${Errors.MissingRightCurlyBracket}`]: "遺漏右大括號",
  [`${Errors.MissingAssignOperator}`]: "遺漏指定運算符",
  [`${Errors.MissingArrow}`]: "遺漏箭頭",
  [`${Errors.InvalidComparation}`]: "關係運算子錯誤",
  [`${Errors.InappropriateBreakStatement}`]: "跳出敘述只能出現在迴圈內",
  [`${Errors.UseDisabledFunction}`]: "使用被禁用的函數"
}

function ThrowError(parser: Parser, errorType: Errors, token: Token | null): void {
  if (!token) {
    token = parser['tokens'][parser['tokens'].length-1];
  }
  parser.errorCount++;
  let output: string = '****';
  for (let i = 0; i<token.right-token.value.length+1; i++) {
    output += ' ';
  }
  parser['movePointerToNext']();
  for (let i = 0; i<token.value.length; i++) {
    output += '~';
  }
  parser.errorMessages.textify +=
    fiveDigits(token.left)+parser.getSource()[token.left-1]
    + '\n' +
    `${output} ${errorToString[errorType]}`
    + '\n';
  parser.errorMessages.errors.push({
    error: errorType,
    errorText: errorToString[errorType],
    line: token.left,
    column: token.right,
    token: token
  });
}

function skip(parser: Parser, nowToken: Tokens): void {
  if (!parser.nowToken) return;
  const followToken = followTokenSet[nowToken];
  while (parser.nowToken && !followToken.includes(parser.nowToken.token)) {
    parser['movePointerToNext']();
  }
}

function fiveDigits(num: number): string {
  return (
    num > 999 ? `${num} ` :
    num > 99 ? ` ${num} ` :
    num > 9 ? `  ${num} ` : `   ${num} `
  );
}

export { Errors, ThrowError, skip }
