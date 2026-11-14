import type { Token } from './token';
import type { CompileError } from '../types/interfaces';

enum Errors {
  UnknownStatement,
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
  InappropriateBreakStatement,
  UnknownLoopSyntax,
  UseDisabledModuleFunction,
  FunctionNotDefined,
  OverloadNotFound,
  RedeclareFunction,
  RedeclareParameter,
  ReturnOutsideFunction,
  InvalidReferenceArgument,
  InvalidFunctionParameter,
  InvalidAssignmentTarget,
  MissingExpression
}

const errorToString: Record<Errors, string> = {
  [`${Errors.UnknownStatement}`]: "未知敘述",
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
  [`${Errors.InappropriateBreakStatement}`]: "跳出敘述只能出現在迴圈內",
  [`${Errors.UnknownLoopSyntax}`]: "未知的迴圈語法",
  [`${Errors.UseDisabledModuleFunction}`]: "使用被禁用的模組函數",
  [`${Errors.FunctionNotDefined}`]: "函式未宣告",
  [`${Errors.OverloadNotFound}`]: "找不到符合參數數量的函式重載",
  [`${Errors.RedeclareFunction}`]: "函式重複宣告",
  [`${Errors.RedeclareParameter}`]: "函數參數重複宣告",
  [`${Errors.ReturnOutsideFunction}`]: "返回敘述只能出現在函式內",
  [`${Errors.InvalidReferenceArgument}`]: "參考參數必須傳入已宣告的識別字",
  [`${Errors.InvalidFunctionParameter}`]: "函式參數宣告錯誤",
  [`${Errors.InvalidAssignmentTarget}`]: "無效的指定目標",
  [`${Errors.MissingExpression}`]: "遺漏運算式"
}

function getErrorReport(errorType: Errors, token: Token): CompileError {
  return {
    error: errorType,
    errorText: errorToString[errorType],
    line: token.left,
    column: token.right,
    token: token
  };
}


export { Errors, getErrorReport }
