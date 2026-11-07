import assert from 'node:assert/strict';
import test from 'node:test';
import { compileAndRun } from '../helpers.js';

test('control-flow: if', async () => {
  const result = await compileAndRun(`
{ 1 == 1 } (
  <<< "true"
)

{ 1 != 1 } (
  <<< "wrong"
)
`);

  assert.equal(result.stdout, 'true');
});

test('control-flow: if else', async () => {
  const result = await compileAndRun(`
{ 1 == 2 } (
  <<< "if"
) / (
  <<< "else"
)
`);

  assert.equal(result.stdout, 'else');
});

test('control-flow: if-elseif-else falls through to elseif', async () => {
  const result = await compileAndRun(`
value := 2

{ value == 1 } (
  <<< "if"
) / { value == 2 } (
  <<< "elseif"
) / { value == 3 } (
  <<< "second-elseif"
) / (
  <<< "else"
)
`);

  assert.equal(result.stdout, 'elseif');
});

test('control-flow: if-elseif-else falls through to else', async () => {
  const result = await compileAndRun(`
value := 4

{ value == 1 } (
  <<< "if"
) / { value == 2 } (
  <<< "elseif"
) / (
  <<< "else"
)
`);

  assert.equal(result.stdout, 'else');
});

test('control-flow: for loop', async () => {
  const result = await compileAndRun(`
[i = 1 -> 3] (
  <<< i
)
`);

  assert.equal(result.stdout, '123');
});

test('control-flow: for loop reverse', async () => {
  const result = await compileAndRun(`
[i = 3 -> 1] (
  <<< i
)
`);

  assert.equal(result.stdout, '');
});

test('control-flow: while loop', async () => {
  const result = await compileAndRun(`
i := 1

[{ i <= 3 }] (
  <<< i
  i = i + 1
)
`);

  assert.equal(result.stdout, '123');
});


test('control-flow: continue statement in for loop', async () => {
  const result = await compileAndRun(`
[i = 1 -> 5] (
  { i == 3 } (
    ->
  )

  <<< i
)
`);

  assert.equal(result.stdout, '1245');
});

test('control-flow: break statement in for loop', async () => {
  const result = await compileAndRun(`
[i = 1 -> 5] (
  { i == 3 } (
    ->|
  )

  <<< i
)
`);

  assert.equal(result.stdout, '12');
});

test('control-flow: continue statement in while loop', async () => {
  const result = await compileAndRun(`
i := 0

[{ i < 5 }] (
  i = i + 1

  { i == 3 } (
    ->
  )

  <<< i
)
`);

  assert.equal(result.stdout, '1245');
});

test('control-flow: break statement in infinite loop', async () => {
  const result = await compileAndRun(`
i := 0

[ -> ] (
  i = i + 1

  { i == 3 } (
    ->|
  )

  <<< i
)
`);

  assert.equal(result.stdout, '12');
});
