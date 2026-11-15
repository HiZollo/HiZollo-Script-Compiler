import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContainsError, compile, createCompiler, Errors } from '../helpers.js';

const cases = [{
  name: 'CantImportNoImportModule',
  source: `
>>> "Private"
`,
  compiler: createCompiler({
    includes: {
      Private: `code:// #noimport

function secret() {
  return "secret";
}

__hzs_export("Private", { secret });`
    }
  }),
  error: Errors.CantImportNoImportModule
}, {
  name: 'DependencyNotFound',
  source: `
>>> "Feature"
`,
  compiler: createCompiler({
    includes: {
      Feature: `code:// #require "Missing"

function answer() {
  return 42;
}

__hzs_export("Feature", { answer });`
    }
  }),
  error: Errors.DependencyNotFound,
  details: { dependencyChain: ['Feature', 'Missing'] }
}, {
  name: 'CircularDependency',
  source: `
>>> "A"
`,
  compiler: createCompiler({
    includes: {
      A: `code:// #require "B"

function fromA() {
  return "A";
}

__hzs_export("A", { fromA });`,

      B: `code:// #require "A"

function fromB() {
  return "B";
}

__hzs_export("B", { fromB });`
    }
  }),
  error: Errors.CircularDependency,
  details: { cycle: ['A', 'B', 'A'] }
}];


for (const item of cases) {
  test(`diagnostic: ${item.name}`, () => {
    const result = compile(item.source, item.compiler ?? createCompiler());
    assertContainsError(result, item.error, item.name);
    assert.equal(result.errorCount, 1, `${item.name}: unexpected diagnostic count\n${result.errorMessages.textify}`);

    if (item.details) {
      const error = result.errorMessages.errors.find(error => error.error === item.error);
      assert.deepEqual(error.details, item.details, `${item.name}: diagnostic details`);
    }
  });
}

