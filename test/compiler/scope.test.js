import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContainsError, compile, compileAndRun, createCompiler, Errors } from '../helpers.js';

test('scope: outer variables are visible inside nested blocks', async () => {
  const result = await compileAndRun(`
a := 10

{ 1 == 1 } (
  <<< a
)
`);

  assert.equal(result.stdout, '10');
});

test('scope: same identifier may be redeclared in a nested block', async () => {
  const result = await compileAndRun(`
a := 1

{ 1 == 1 } (
  a := 2
  <<< a
)

<<< a
`);

  assert.equal(result.stdout, '21');
});

test('scope: inner variables do not leak outside their block', () => {
  const result = compile(`
{ 1 == 1 } (
  inner := 1
)

<<< inner
`);

  assertContainsError(
    result,
    Errors.IdentifierNotDefined,
    'inner variable scope'
  );
});

test('scope: for loop variable does not leak outside the loop', () => {
  const result = compile(`
[i = 1 -> 2] (
  <<< i
)

<<< i
`);

  assertContainsError(
    result,
    Errors.IdentifierNotDefined,
    'for loop variable scope'
  );
});

test('scope: outer loop variable remains visible inside an inner loop', async () => {
  const result = await compileAndRun(`
[i = 1 -> 2] (
  [j = 1 -> 2] (
    <<< i
    <<< j
  )
)
`);

  assert.equal(result.stdout, '11122122');
});

test('scope: same-level redeclaration remains an error', () => {
  const result = compile(`
a := 1
a := 2
`);

  assertContainsError(
    result,
    Errors.RedeclareIdentifier,
    'same-level redeclaration'
  );
});

test('scope: compiler scope state resets between compilations', () => {
  const compiler = createCompiler();

  const first = compiler.compile(`
{ 1 == 1 } (
  temp := 1
)
`);

  assert.equal(first.errorCount, 0);

  const second = compiler.compile(`
<<< temp
`);

  assertContainsError(
    second,
    Errors.IdentifierNotDefined,
    'compiler reuse scope reset'
  );
});

test('scope: TDZ in JavaScript does not happen', async () => {
  const result = await compileAndRun(`
a := 1

{ 1 == 1 } ( 
  <<< a
  a := 2
  <<< a
)
`);

  assert.equal(result.stdout, '12');
})

test('scope: for index variable shadowing', async () => {
  const result = await compileAndRun(`
i := 10
[ i = 1 -> 3 ] (
  <<< i
)
`);

  assert.equal(result.stdout, '123');
})
