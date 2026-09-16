import { Scanner } from './structure/scanner';
import { Parser } from './structure/parser';
import { CompilerOptions, CompileResult, PathMap } from './types/interfaces';
import { minify } from 'uglify-js';

const bootstrapCode = minify(`
globalThis.__hzs__ = {
  __module__: __HZS_MODULE_LIST__,
  __data__: Object.create(null),
  __fn__: Object.create(null),
  __callable__: Object.create(null),
  __warnings__: []
};

class HZSRuntimeError extends Error {
  constructor(message) {
    super(message);
    this.name = "HZSRuntimeError"
  }
}

class HZSWarning {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
}

function __hzs_export(ns, obj_of_func) {
  for (const [funcName, func] of Object.entries(obj_of_func)) {
    if (globalThis.__hzs__.__callable__[funcName]) {
      let oldNs = "unknown";
      for (const [ns, funcs] of Object.entries(globalThis.__hzs__.__fn__)) {
        if (funcs[funcName]) {
          oldNs = ns;
          break;
        }
      }

      globalThis.__hzs__.__warnings__.push(
        new HZSWarning("FUNCTION_COLLISION", { fn: funcName, oldNs, newNs: ns })
      );
    }
    globalThis.__hzs__.__callable__[funcName] = func;
  }

  globalThis.__hzs__.__fn__[ns] = { 
    ...(globalThis.__hzs__.__fn__[ns] || {}), 
    ...obj_of_func 
  };
}

function __hzs_invoke(name, ...args) {
  const func = globalThis.__hzs__.__callable__[name];
  if (!func) {
    throw new HZSRuntimeError(\`Function '\${name}' is not defined or imported.\`);
  }
  if (typeof func !== "function") {
    throw new HZSRuntimeError(\`\${name} is not a function.\`);
  }
  return func(...args);
}`).code;

class Compiler {
  private parser: Parser;
  private includes: PathMap;
  private disabledFunctions

  constructor({ includes = {}, disabledFunctions = [] }: CompilerOptions) {
    if (!includes?.core) throw new Error('MISSING_CORE_MODULE');
    this.includes = includes;
    this.disabledFunctions = disabledFunctions;
    this.parser = new Parser(this.includes, this.disabledFunctions, bootstrapCode);
  }

  public compile(source: string): CompileResult {
    const scanner = new Scanner();
    scanner.read(source);

    this.parser.init(scanner);
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
