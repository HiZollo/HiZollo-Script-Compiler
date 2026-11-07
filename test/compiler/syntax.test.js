import assert from 'node:assert/strict';
import test from 'node:test';
import { compileAndRun, compile, createCompiler, CORE } from '../helpers.js';

test('syntax: declaration and assignment', async () => {
  const result = await compileAndRun(`
a := 1
a = 2
<<< a
`);

  assert.equal(result.stdout, '2');
});

test('syntax: declaration and assignment with expression', async () => {
  const result = await compileAndRun(`
a := 1 + 2 * 3
<<< a
a = 3 + 2 * 1
<<< a
`);

  assert.equal(result.stdout, '75');
})

test('syntax: swap exchanges two variables', async () => {
  const result = await compileAndRun(`
a := 1
b := 2
a <-> b
<<< a
<<< b
`);

  assert.equal(result.stdout, '21');
});

test('syntax: print accepts strings, expressions and variables', async () => {
  const result = await compileAndRun(`
a := 2
<<< "x"
<<< 1 + a
<<< a
`);

  assert.equal(result.stdout, 'x32');
});

test('syntax: function calls support zero, one and multiple parameters', async () => {
  const result = await compileAndRun(`
>>> "Math"
>>> "Util"

<<< true()
<<< add(1, 2)
<<< choose("first", 2, 3)
`);

  assert.equal(result.stdout, 'true3first');
});

test('syntax: function parameters can mix strings and expressions', async () => {
  const result = await compileAndRun(`
>>> "Math"
<<< add(1 + 2, (3 * 4))
`);

  assert.equal(result.stdout, '15');
});

test('syntax: all supported comment prefixes are ignored', async () => {
  const result = await compileAndRun(`
' comment
; comment
# comment

a := 1
<<< a
`);

  assert.equal(result.stdout, '1');
});

test('syntax: all six comparison operators are accepted', async () => {
  const result = await compileAndRun(`
{ 2 > 1 } (
  <<< ">"
)

{ 2 >= 2 } (
  <<< ">="
)

{ 2 == 2 } (
  <<< "=="
)

{ 2 <= 2 } (
  <<< "<="
)

{ 1 < 2 } (
  <<< "<"
)

{ 2 != 1 } (
  <<< "!="
)
`);

  assert.equal(result.stdout, '>>===<=<!=' );
});

test('syntax: core module is available without explicit import', async () => {
  const result = await compileAndRun(`
<<< "ok"
`);

  assert.equal(result.stdout, 'ok');
});

test('syntax: inline module code can be imported and invoked', async () => {
  const compiler = createCompiler({
    includes: {
      Extra: 'code:function answer() { return 42; } __hzs_export("Extra", { answer });'
    }
  });

  const result = await compileAndRun(`
>>> "Extra"
<<< answer()
`, { compiler });

  assert.equal(result.stdout, '42');
});

test('syntax: module file paths can be loaded', async (t) => {
  // Use a temporary module fixture only when the test environment supports fs.
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const dir = await mkdtemp(join(tmpdir(), 'hizollo-test-'));
  const modulePath = join(dir, 'extra.js');

  await writeFile(
    modulePath,
    'function answer() { return 7; } __hzs_export("Extra", { answer });',
    'utf8'
  );

  const compiler = createCompiler({
    includes: { Extra: modulePath }
  });

  const result = await compileAndRun(`
>>> "Extra"
<<< answer()
`, { compiler });

  assert.equal(result.stdout, '7');

  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  });
});

test('syntax: empty file compiles', () => {
  const result = compile('');

  assert.equal(result.errorCount, 0);
})


test('syntax: file with comment only compiles', () => {
  const result1 = compile('\' Test');
  const result2 = compile(`
; Test
# Test
' Test
`);
  const result3 = compile('\'');

  assert.equal(result1.errorCount, 0);
  assert.equal(result2.errorCount, 0);
  assert.equal(result3.errorCount, 0);
})

test('syntax: escape character', async () => {
  const result = await compileAndRun(`
<<< "test\\n"
<<< "\\"\\'\\\`\\\\"
`);

  assert.equal(result.stdout, "test\n\"\'\`\\");
})
