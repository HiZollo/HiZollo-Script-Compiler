import assert from 'node:assert/strict';
import test from 'node:test';

import { assertContainsError, compile, compileAndRun, Errors } from '../helpers.js';


// --------------------------------------------------
// Basic Function Calls
// --------------------------------------------------

test('custom function: call and return value', async () => {
  const result = await compileAndRun(`
$add := (a, b) (
  $ <- a + b
)

<<< $add(10, 20)
`);

  assert.equal(result.stdout, '30');
});


test('custom function: call inside expression', async () => {
  const result = await compileAndRun(`
$add := (a, b) (
  $ <- a + b
)

result := $add(2, 3) * 4

<<< result
`);

  assert.equal(result.stdout, '20');
});


test('custom function: call as a statement', async () => {
  const result = await compileAndRun(`
$increment := (*value) (
  value = value + 1
)

value := 10

$increment(value)

<<< value
`);

  assert.equal(result.stdout, '11');
});


// --------------------------------------------------
// Function Overloading
// --------------------------------------------------

test('custom function: overload resolution by arity', async () => {
  const result = await compileAndRun(`
$sum := (a) (
  $ <- a
)

$sum := (a, b) (
  $ <- a + b
)

<<< $sum(7)
<<< ","
<<< $sum(3, 4)
`);

  assert.equal(result.stdout, '7,7');
});


test('custom function: missing overload', () => {
  const result = compile(`
$sum := (a) (
  $ <- a
)

$sum(1, 2)
`);

  assertContainsError(result, Errors.OverloadNotFound, 'missing overload');
});


test('custom function: undefined function', () => {
  const result = compile(`
$missing(1, 2)
`);

  assertContainsError(result, Errors.FunctionNotDefined, 'undefined function');
});


// --------------------------------------------------
// Reference Parameters
// --------------------------------------------------

test('custom function: reference parameter modifies caller variable', async () => {
  const result = await compileAndRun(`
$increment := (*value) (
  value = value + 1
)

counter := 100

$increment(counter)

<<< counter
`);

  assert.equal(result.stdout, '101');
});


test('custom function: multiple reference parameters', async () => {
  const result = await compileAndRun(`
$swap := (*a, *b) (
  temp := a
  a = b
  b = temp
)

a := 10
b := 20

$swap(a, b)

<<< a
<<< ","
<<< b
`);

  assert.equal(result.stdout, '20,10');
});


test('custom function: reference parameter forwarding', async () => {
  const result = await compileAndRun(`
$increment := (*x) (
  x = x + 1
)

$forward := (*y) (
  $increment(y)
)

value := 1

$forward(value)

<<< value
`);

  assert.equal(result.stdout, '2');
});


test('custom function: invalid reference argument', () => {
  const result = compile(`
$increment := (*value) (
  value = value + 1
)

$increment(10 + 20)
`);

  assertContainsError(
    result,
    Errors.InvalidReferenceArgument,
    'invalid reference argument'
  );
});


// --------------------------------------------------
// Nested Calls
// --------------------------------------------------

test('custom function: nested function calls', async () => {
  const result = await compileAndRun(`
$add := (a, b) (
  $ <- a + b
)

$multiply := (a, b) (
  $ <- a * b
)

<<< $add($multiply(2, 3), 4)
`);

  assert.equal(result.stdout, '10');
});


// --------------------------------------------------
// Recursion
// --------------------------------------------------

test('custom function: recursive function call', async () => {
  const result = await compileAndRun(`
$factorial := (n) (
  { n <= 1 } (
    $ <- 1
  ) / (
    $ <- n * $factorial(n - 1)
  )
)

<<< $factorial(5)
`);

  assert.equal(result.stdout, '120');
});

