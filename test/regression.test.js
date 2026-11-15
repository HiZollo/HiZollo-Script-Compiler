import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from './helpers.js';

test('regression: trailing whitespace at EOF does not crash compiler', () => {
  const result = compile('a := 1 ');

  assert.equal(result.errorCount, 0);
});

test('regression: negative column cause range error on error formatter', () => {
  const source = `>>
>>
0)


[{ r>= > 6 }] (
  \<<< r <<< ==" "
  rt(<=1, 10)
)
`;

  assert.doesNotThrow(() => compile(source));
});
