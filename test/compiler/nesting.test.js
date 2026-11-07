import assert from 'node:assert/strict';
import test from 'node:test';
import { compileAndRun } from '../helpers.js';

test('nesting: if inside if', async () => {
  const result = await compileAndRun(`
{ 1 == 1 } (
  { 2 == 2 } (
    <<< "nested"
  )
)
`);

  assert.equal(result.stdout, 'nested');
});

test('nesting: for inside if', async () => {
  const result = await compileAndRun(`
{ 1 == 1 } (
  [i = 1 -> 2] (
    <<< i
  )
)
`);

  assert.equal(result.stdout, '12');
});

test('nesting: if inside for', async () => {
  const result = await compileAndRun(`
[i = 1 -> 3] (
  { i == 2 } (
    <<< i
  )
)
`);

  assert.equal(result.stdout, '2');
});

test('nesting: for inside for', async () => {
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

test('nesting: continue statement in an if inside while', async () => {
  const result = await compileAndRun(`
i := 0

[{ i < 4 }] (
  i = i + 1

  { i == 2 } (
    ->
  )

  <<< i
)
`);

  assert.equal(result.stdout, '134');
});

test('nesting: break and continue statement in double loop', async () => {
  const result = await compileAndRun(`
[i = 1 -> 2] (
  [j = 1 -> 3] (
    { j == 2 } (
      ->
    )

    { j == 3 } (
      ->|
    )

    <<< i
    <<< j
  )
)
`);

  assert.equal(result.stdout, '1121');
});

test('nesting: deep nested control flow', async () => {
  const result = await compileAndRun(`
outer := 1

{ outer == 1 } (
  [i = 1 -> 2] (
    { i == 1 } (
      [j = 1 -> 2] (
        <<< i
        <<< j
      )
    )
  )
)
`);

  assert.equal(result.stdout, '1112');
});

test('nesting: nested if-elseif-else inside for', async () => {
  const result = await compileAndRun(`
[i = 1 -> 3] (
  { i == 1 } (
    <<< "a"
  ) / { i == 2 } (
    <<< "b"
  ) / (
    <<< "c"
  )
)
`);

  assert.equal(result.stdout, 'abc');
});
