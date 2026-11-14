import { Scanner } from './structure/scanner';
import { Parser } from './structure/parser';
import type { CompilerOptions, CompileResult, PathMapWithCore, CompileError } from './types/interfaces';
import bootstrapCodeTemplate from 'virtual:hzscript-bootstrap';
import { ModuleResolver } from './structure/module-resolver';

class Compiler {
  private scanner: Scanner;
  private parser: Parser;
  private moduleResolver: ModuleResolver;
  private includes: PathMapWithCore;
  private disabledFunctions

  constructor({ includes = {}, disabledFunctions = [] }: CompilerOptions) {
    if (!includes?.core) throw new Error('MISSING_CORE_MODULE');
    this.includes = Object.create(null);
    Object.assign(this.includes, includes);

    this.disabledFunctions = disabledFunctions;
    this.scanner = new Scanner();
    this.parser = new Parser(this.disabledFunctions);
    this.moduleResolver = new ModuleResolver(this.includes);
  }

  public compile(source: string): CompileResult {
    this.scanner.init();
    this.scanner.read(source);

    this.parser.init(this.scanner);
    const parserResult = this.parser.parse();

    const resolverResult = this.moduleResolver.resolve(parserResult.explicitImportedModule)

    const errors = [...resolverResult.errors, ...parserResult.errors]
    const textifiedErrors = this.makeErrorMessage(errors);

    // 生成 Runtime Bootstrap
    const moduleList = JSON.stringify(Object.fromEntries(resolverResult.importedModule.map(name => [name, true])))
    const disabledModuleFunctionsList = JSON.stringify(Object.fromEntries(this.disabledFunctions.map(name => [name, true])))
    const bootstrapCode = bootstrapCodeTemplate
      .replace("__HZS_MODULE_LIST__", moduleList)
      .replace("__HZS_DISABLED_MODULE_FUNCTIONS_LIST__", disabledModuleFunctionsList)
    const resultCode = `${bootstrapCode}${resolverResult.moduleCode}${parserResult.transpiledCode}`;

    return {
      errorCount: errors.length,
      errorMessages: {
        textify: textifiedErrors,
        errors: errors
      },
      build: {
        partial: parserResult.transpiledCode,
        full: resultCode
      }
    }
  }

  private makeErrorMessage(errors: CompileError[]): string {
    let result = '';
    for (const error of errors) {
      let output: string = '****';
      for (let i = 0; i<error.token.right-error.token.value.length+1; i++) {
        output += ' ';
      }
      for (let i = 0; i<error.token.value.length; i++) {
        output += '~';
      }
      result += 
        fiveDigits(error.token.left)+this.scanner.getSource()[error.token.left-1]
        + '\n' +
        `${output} ${error.errorText}`
        + '\n';
    }
    return result;
  }
}

function fiveDigits(num: number): string {
  return (
    num > 999 ? `${num} ` :
    num > 99 ? ` ${num} ` :
    num > 9 ? `  ${num} ` : `   ${num} `
  );
}

export { Compiler };
