import test from 'node:test';
import { assertContainsError, compile, createCompiler, Errors } from '../helpers.js';

const cases = [{
  name: 'UnknownStatement',
  source: '?',
  error: Errors.UnknownStatement
}, {
  name: 'CantImportCoreModule',
  source: '>>> "core"',
  error: Errors.CantImportCoreModule
}, {
  name: 'AlreadyImported',
  source: `
>>> "Math"
>>> "Math"
`,
  error: Errors.AlreadyImported
}, {
  name: 'LateImport',
  source: `
a := 1
>>> "Math"
`,
  error: Errors.LateImport
}, {
  name: 'MissingModuleName',
  source: '>>>',
  error: Errors.MissingModuleName
}, {
  name: 'ModuleNotFound',
  source: '>>> "MissingModule"',
  error: Errors.ModuleNotFound
}, {
  name: 'MissingIdentifier',
  source: `
a := 1
b := 2
a <->
`,
  error: Errors.MissingIdentifier
}, {
  name: 'IdentifierNotDefined',
  source: `
<<< missing
`,
  error: Errors.IdentifierNotDefined
}, {
  name: 'RedeclareIdentifier',
  source: `
a := 1
a := 2
`,
  error: Errors.RedeclareIdentifier
}, {
  name: 'MissingLeftBracketInIf',
  source: `
{ 1 == 1 } 1
`,
  error: Errors.MissingLeftBracket
}, {
  name: 'MissingLeftBracketInLoop',
  source: `
[ -> ] 1
`,
  error: Errors.MissingLeftBracket
}, {
  name: 'MissingLeftBracketInElse',
  source: `
{ 1 == 1 } () / 1
`,
  error: Errors.MissingLeftBracket
}, {
  name: 'MissingRightBracketInFunction',
  source: `
foo(1
`,
  error: Errors.MissingRightBracket
}, {
  name: 'MissingRightBracketInIf',
  source: `
{ 1 == 1 } (
<<< 1
`,
  error: Errors.MissingRightBracket
}, {
  name: 'MissingRightSquareBracket',
  source: '[i = 1 -> 2',
  error: Errors.MissingRightSquareBracket
}, {
  name: 'MissingRightCurlyBracketInIf',
  source: '{ 1 == 1',
  error: Errors.MissingRightCurlyBracket
}, {
  name: 'MissingAssignOperator',
  source: '[i -> 2] ()',
  error: Errors.MissingAssignOperator
}, {
  name: 'MissingArrow',
  source: '[i = 1] ()',
  error: Errors.MissingArrow
}, {
  name: 'InappropriateBreakStatement',
  source: '->',
  error: Errors.InappropriateBreakStatement
}, {
  name: 'UnknownLoopSyntax',
  source: '[1] ()',
  error: Errors.UnknownLoopSyntax
}, {
  name: 'UseDisabledModuleFunction',
  source: 'eval()',
  compiler: createCompiler({ disabledFunctions: ['eval'] }),
  error: Errors.UseDisabledModuleFunction
}];

for (const item of cases) {
  test(`diagnostic: ${item.name}`, () => {
    const result = compile(item.source, item.compiler ?? createCompiler());
    assertContainsError(result, item.error, item.name);
  });
}
