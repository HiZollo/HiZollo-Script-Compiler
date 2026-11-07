import assert from 'node:assert/strict';
import { Compiler, ExecutionError, ExecutionErrorCode, ExecutionTimeoutError, ExecutionWorker, Errors } from '../dist/index.mjs';

export { Compiler, ExecutionError, ExecutionErrorCode, ExecutionTimeoutError, ExecutionWorker, Errors }

export const esm = await import('../dist/index.mjs');

export const CORE = `
function _start() {}

function _write(content) {
  process.stdout.write(String(content));
}

function _panic(error) {
  throw error;
}

function _end() {}
`;

export const MATH = `
function add(a, b) {
  return a + b;
}

function isPrime(n) {
  if (n < 2) return false;

  for (let i = 2; i <= Math.sqrt(n); i += 1) {
    if (n % i === 0) return false;
  }

  return true;
}

function randomInt(a) {
  return a;
}

function trueFn() {
  return true;
}

__hzs_export("Math", {
  add,
  isPrime,
  randomInt,
  true: trueFn
});
`;

export const UTIL = `
function choose(...values) {
  return values[0];
}

__hzs_export("Util", {
  choose
});
`;

export function createCompiler({
  includes = {},
  disabledFunctions = []
} = {}) {
  return new Compiler({
    includes: {
      core: `code:${CORE}`,
      Math: `code:${MATH}`,
      Util: `code:${UTIL}`,
      ...includes
    },
    disabledFunctions
  });
}

export function compile(source, compiler = createCompiler()) {
  return compiler.compile(source);
}

export async function compileAndRun(
  source,
  { compiler = createCompiler(), maxExecutionTime = 1000, argv = [] } = {}
) {
  const result = compiler.compile(source);

  assert.equal(
    result.errorCount,
    0,
    result.errorMessages.textify
  );

  return new ExecutionWorker(result.build.full).execute({
    maxExecutionTime,
    argv
  });
}

export function assertContainsError(result, expectedError, name = 'diagnostic') {
  const hasExpectedError = result.errorMessages.errors.some(
    error => error.error === expectedError
  );

  assert.ok(
    hasExpectedError,
    [
      `${name}: expected diagnostic ${String(expectedError)}`,
      `actual error count: ${result.errorCount}`,
      '',
      result.errorMessages.textify
    ].join('\n')
  );
}
