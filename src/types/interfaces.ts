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
  includes: PathMap
  disabledFunctions: string[]
}

export interface PathMap {
  [key: string]: string
}

export interface PathMapWithCore extends PathMap {
  core: string
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

export type ExecutionOutputLimitBehavior = 'halt' | 'stop' | 'roll';

export interface ExecutionOutputLimitOptions {
  maxOutputSize: number;
  onLimit?: ExecutionOutputLimitBehavior;
}

export interface ExecuteOptions {
  maxExecutionTime: number
  resourceLimits?: {
    maxOldGenerationSizeMb?: number
    maxYoungGenerationSizeMb?: number
    stackSizeMb?: number
    codeRangeSizeMb?: number
  }
  stdout?: number | ExecutionOutputLimitOptions
  stderr?: number | ExecutionOutputLimitOptions
  argv?: string[]
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  outputLimitExceeded: {
    stdout: boolean;
    stderr: boolean;
  };
}

export interface TokenOption {
  token: Tokens,
  left: number,
  right: number,
  value: string
}
