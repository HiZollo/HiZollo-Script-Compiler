import { Scanner } from './structure/scanner';
import { Parser } from './structure/parser';
import { CompilerOptions, CompileResult, PathMap } from './types/interfaces';

class Compiler {
  private parser: Parser;
  private includes: PathMap;

  constructor(options: CompilerOptions) {
    if (!options?.includes?.core) throw new Error('MISSING_CORE_MODULE');
    this.includes = options.includes;
    this.parser = new Parser(this.includes);
  }

  public compile(source: string): CompileResult {
    const scanner = new Scanner();
    scanner.read(source);

    this.parser.init(scanner);
    this.parser.parse();

    return {
      errorCount: this.parser.errorCount,
      errorMessages: this.parser.errorMessages,
      build: this.parser.result
    }

  }

}

export { Compiler };
