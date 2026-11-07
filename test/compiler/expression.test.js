import assert from 'node:assert/strict';
import test from 'node:test';
import { compileAndRun } from '../helpers.js';

test('expression: numeric literal', async () => {
  const result = await compileAndRun(`
<<< 0
<<< 123
<<< 123.456
<<< 555.
<<< 0000033
<<< .0001
`);

  assert.equal(result.stdout, '0123123.456555330.0001');
});

test('expression: binary operator precedence', async () => {
  const result = await compileAndRun(`
<<< 1 + 2 * 3
<<< (1 + 2) * 3
<<< 20 / 2 + 3
<<< 20 / (2 + 3)
`);

  assert.equal(result.stdout, '79134');
});

test('expression: unary operator', async () => {
  const result = await compileAndRun(`
<<< -1
<<< +1
<<< --1
<<< ++1
<<< +-1
<<< -+1
<<< +++1
<<< ---1
<<< +-+-+-1
`);

  assert.equal(result.stdout, '-1111-1-11-1-1');
});

test('expression: nested parentheses', async () => {
  const result = await compileAndRun(`
<<< (((1)))
<<< ((1 + 2) * (3 + 4))
<<< (1 + (2 * (3 + (4 * 5))))
`);

  assert.equal(result.stdout, '12147');
});

test('expression: function calls', async () => {
  const result = await compileAndRun(`
>>> "Math"
<<< add(1, 2) * 3 + 4
<<< 10 - add(2, 3) * 2
`);

  assert.equal(result.stdout, '130');
});

test('expression: crazy unary and binary expression', async () => {
  const result = await compileAndRun(`
<<< 000555.+++++-----+-+333.3333----------+-.0001
`);

  assert.equal(result.stdout, '888.3332');
});

test('expression: long unary operator', async () => {
  const result = await compileAndRun(`
<<< +++++++++++++++++++++++++1
<<< -------------------------1
<<< +-+-+-+-+-+-+-+-+-+-+-+-+-1
`);

  assert.equal(result.stdout, '1-1-1');
});
