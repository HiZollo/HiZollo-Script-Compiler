import type { Errors } from '../constant/errors';
import type { Token } from '../constant/token';

export interface CompileResult {
  errorCount: number,
  errorMessages: ErrorOutput,
  build: string
}

export interface CompilerOptions {
  includes: PathMap
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
