import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContainsError, compile, compileAndRun, createCompiler, Errors } from '../helpers.js';

test('module preamble: #require resolves dependencies before the importing module', async () => {
  const compiler = createCompiler({
    includes: {
      Base: `code:globalThis.__baseLoadCount = (globalThis.__baseLoadCount ?? 0) + 1;

function baseLoadCount() {
  return globalThis.__baseLoadCount;
}

__hzs_export("Base", { baseLoadCount });`,

      Middle: `code:// #require "Base"
function middleLoadCount() {
  return baseLoadCount();
}

__hzs_export("Middle", { middleLoadCount });`,

      Feature: `code:

// Feature module metadata
// #require "Base"

// #require "Middle"
// #require "Base"

globalThis.__featureSnapshot = middleLoadCount();

function featureLoadCount() {
  return globalThis.__featureSnapshot;
}

__hzs_export("Feature", { featureLoadCount });`
    }
  });

  const result = await compileAndRun(`
>>> "Feature"
>>> "Base"

<<< featureLoadCount()
`, { compiler });

  assert.equal(result.stdout, '1');
});


test('module preamble: #noimport prevents explicit imports', () => {
  const compiler = createCompiler({
    includes: {
      Private: `code:// #noimport

function secret() {
  return "secret";
}

__hzs_export("Private", { secret });`
    }
  });

  const result = compile(`
>>> "Private"
`, compiler);

  assertContainsError(result, Errors.CantImportNoImportModule, '#noimport explicit import');
});


test('module preamble: #noimport modules can still be imported as dependencies', async () => {
  const compiler = createCompiler({
    includes: {
      Private: `code:// #noimport

function secret() {
  return "secret";
}

__hzs_export("Private", { secret });`,

      Public: `code:// #require "Private"

function reveal() {
  return secret();
}

__hzs_export("Public", { reveal });`
    }
  });

  const result = await compileAndRun(`
>>> "Public"

<<< reveal()
`, { compiler });

  assert.equal(result.stdout, 'secret');
});


test('module preamble: directives after the module body starts are ignored', async () => {
  const compiler = createCompiler({
    includes: {
      Feature: `code:function answer() {
  return 42;
}

// #require "Missing"

__hzs_export("Feature", { answer });`
    }
  });

  const result = await compileAndRun(`
>>> "Feature"

<<< answer()
`, { compiler });

  assert.equal(result.stdout, '42');
});


test('module preamble: #require reports missing dependencies', () => {
  const compiler = createCompiler({
    includes: {
      Feature: `code:// #require "Missing"

function answer() {
  return 42;
}

__hzs_export("Feature", { answer });`
    }
  });

  const result = compile(`
>>> "Feature"
`, compiler);

  assertContainsError(result, Errors.DependencyNotFound, '#require missing dependency');
  const error = result.errorMessages.errors.find(item => item.error === Errors.DependencyNotFound);
  assert.deepEqual(error.details.dependencyChain, ['Feature', 'Missing']);
});


test('module preamble: #require detects circular dependencies', () => {
  const compiler = createCompiler({
    includes: {
      A: `code:// #require "B"

function fromA() {
  return "A";
}`,

      B: `code:// #require "A"

function fromB() {
  return "B";
}`
    }
  });

  const result = compile(`
>>> "A"
`, compiler);

  assertContainsError(result, Errors.CircularDependency, '#require circular dependency');
  const error = result.errorMessages.errors.find(item => item.error === Errors.CircularDependency);
  assert.deepEqual(error.details.cycle, ['A', 'B', 'A']);
});

test('module preamble: #require detects implicit circular dependencies', () => {
  const compiler = createCompiler({
    includes: {
      A: `code:// #require "B"

function fromA() {
  return "A";
}`,
      B: `code:// #require "A"

function fromB() {
  return "B";
}`,
      C: `code:// #require "A"

function fromC() {
  return "C"
}`
    }
  });

  const result = compile(`
>>> "C"
`, compiler);

  assertContainsError(result, Errors.CircularDependency, '#require circular dependency'
  );
  const error = result.errorMessages.errors.find(item => item.error === Errors.CircularDependency);
  assert.deepEqual(error.details.cycle, ['A', 'B', 'A']);
});

