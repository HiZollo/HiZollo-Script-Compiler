import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { createCompiler } from '../helpers.js';

test('example: all bundled examples compile', async () => {
  const examplesDir = new URL('../../examples/', import.meta.url);
  const files = (await readdir(examplesDir))
    .filter(name => name.endsWith('.hzs'))
    .sort();

  assert.ok(files.length > 0, 'examples directory should contain .hzs files');

  const compiler = createCompiler();

  for (const file of files) {
    const source = await readFile(new URL(file, examplesDir), 'utf8');
    const result = compiler.compile(source);

    assert.equal(result.errorCount, 0, `${file}\n${result.errorMessages.textify}`);
  }
});
