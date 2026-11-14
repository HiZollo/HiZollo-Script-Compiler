import { Scanner } from './structure/scanner';
import { Parser } from './structure/parser';
import type { CompilerOptions, CompileResult, PathMapWithCore } from './types/interfaces';
import bootstrapCode from 'virtual:hzscript-bootstrap';

class Compiler {
  private scanner: Scanner;
  private parser: Parser;
  private includes: PathMapWithCore;
  private disabledFunctions

  constructor({ includes = {}, disabledFunctions = [] }: CompilerOptions) {
    if (!includes?.core) throw new Error('MISSING_CORE_MODULE');
    this.includes = Object.create(null);
    Object.assign(this.includes, includes);

    this.disabledFunctions = disabledFunctions;
    this.scanner = new Scanner();
    this.parser = new Parser(this.includes, this.disabledFunctions, bootstrapCode);
  }

  public compile(source: string): CompileResult {
    this.scanner.init();
    this.scanner.read(source);

    this.parser.init(this.scanner);
    this.parser.parse();

    return {
      errorCount: this.parser.errorCount,
      errorMessages: this.parser.errorMessages,
      build: {
        partial: this.parser.transpiledCode,
        full: this.parser.result
      }
    }

  }

}

export { Compiler };
