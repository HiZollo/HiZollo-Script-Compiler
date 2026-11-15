import type { Errors } from '../constant/errors';
import type { Token, Tokens } from '../constant/token';

export interface ParserResult {
  errors: CompileError[],
  transpiledCode: string,
  explicitImportedModule: Token[]
}

export interface ModuleResolverResult {
  errors: CompileError[],
  moduleCode: string,
  importedModule: string[]
}

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
  disabledFunctions?: string[]
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

export type CompileErrorDetailsMap = {
  [Errors.CircularDependency]: {
    cycle: string[];
  };

  [Errors.DependencyNotFound]: {
    dependencyChain: string[];
  };
};

export interface DiagnosticLocation {
  line: number;
  column: number;
  length: number;
}

export interface CompileErrorBase<E extends Errors> {
  error: E;
  errorText: string;
  location: DiagnosticLocation;
};

export type CompileErrorFor<E extends Errors> =
  E extends Errors
    ? CompileErrorBase<E> &
        (E extends keyof CompileErrorDetailsMap
          ? { details: CompileErrorDetailsMap[E] }
          : { details?: never })
    : never;

export type CompileError = CompileErrorFor<Errors>;

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
