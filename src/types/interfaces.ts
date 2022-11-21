import type { Errors } from '../constant/errors';
import type { Token, Tokens } from '../constant/token';

export interface CompileResult {
  errorCount: number,
  errorMessages: ErrorOutput,
  build: BuildResult
}

export interface BuildResult {
  partial: string,
  full: string
}

export interface CompilerOptions {
  includes: PathMap,
  disabledFunctions: string[]
}

export interface PathMap {
  [key: string]: string
}

export interface ErrorOutput {
  textify: string,
  errors: CompileError[]
}

export interface CompileError {
  error: Errors,
  errorText: string,
  line: number,
  column: number,
  token: Token
}

export interface TranslateMap {
  [index: string]: string
}

export interface ExecuteOptions {
  maxExecutionTime: number
}

export interface TokenOption {
  token: Tokens,
  left: number,
  right: number,
  value: string
}
