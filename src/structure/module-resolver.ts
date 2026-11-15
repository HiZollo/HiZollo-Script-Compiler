import { readFileSync } from 'node:fs';
import { Errors, getErrorReport } from '../constant/errors';
import { Token } from '../constant/token';
import type { CompileError, ModuleResolverResult, PathMapWithCore } from '../types/interfaces';

type ModuleState = 'visiting' | 'resolved' | 'failed';

interface ExtractedPreamble {
  preamble: string;
  body: string;
}

interface ModuleDependency {
  name: string;
}

interface ParsedModule {
  body: string;
  dependencies: ModuleDependency[];
}

class ModuleResolver {
  private errors: CompileError[] = [];
  private importedModule: string[] = [];
  private explicitImportedSet: Set<string> = new Set<string>();
  private moduleStates: Map<string, ModuleState> = new Map<string, ModuleState>();
  private moduleErrors: Map<string, Errors> = new Map<string, Errors>();
  private resolvingStack: string[] = [];
  private moduleCode: string = '';
  constructor(private readonly includePath: PathMapWithCore) {}

  public init(): void {
    this.errors = [];
    this.importedModule = [];

    this.explicitImportedSet.clear();
    this.moduleStates.clear();
    this.moduleErrors.clear();

    this.resolvingStack = [];
    this.moduleCode = '';
  }

  public resolve(explicitImportedModule: Token[]): ModuleResolverResult {
    this.loadCoreModule();

    // 依照 Parser 提供的 Token 順序解析模組
    for (const token of explicitImportedModule) {
      const moduleName = token.value.slice(1, -1);

      // 不允許手動引入核心模組
      if (moduleName === 'core') {
        this.reportError(Errors.CantImportCoreModule, token);
        continue;
      }

      // 防止重複引入
      // 只有使用者手動重複引入才會報錯
      if (this.explicitImportedSet.has(moduleName)) {
        this.reportError(Errors.AlreadyImported, token);
        continue;
      }

      this.explicitImportedSet.add(moduleName);
      this.resolveModule(moduleName, token, false);
    }

    return {
      errors: this.errors,
      moduleCode: this.moduleCode,
      importedModule: this.importedModule
    };
  }

  // ==================================================
  // Module Loading
  // ==================================================

  private loadCoreModule(): void {
    const source = this.readModule(this.includePath.core);
    this.moduleCode += source.trim() + '\n';
  }

  private readModule(pathOrCode: string): string {
    return pathOrCode.startsWith('code:')
      ? pathOrCode.slice(5)
      : readFileSync(pathOrCode, 'utf-8');
  }

  private readModuleByName(name: string): string {
    const pathOrCode = this.includePath[name];
    if (!pathOrCode) {
      throw Object.assign(new Error('MODULE_NOT_FOUND'), { code: 'MODULE_NOT_FOUND' });
    }

    return this.readModule(pathOrCode);
  }

  private loadModule(name: string): ParsedModule {
    const source = this.readModuleByName(name);

    const { preamble, body } = this.extractPreamble(source);
    const dependencies = this.parseDependencies(preamble);

    return { body, dependencies };
  }

  private extractPreamble(source: string): ExtractedPreamble {
    const lines = source.split(/\r?\n/);
    let preambleEnd = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();

      if (!trimmed) {
        preambleEnd = i + 1;
        continue;
      }

      if (!trimmed.startsWith('//')) break;

      preambleEnd = i + 1;
    }

    return {
      preamble: lines.slice(0, preambleEnd).join('\n'),
      body: lines.slice(preambleEnd).join('\n')
    };
  }

  /**
   * Parse dependency declarations from the preamble.
   */
  private parseDependencies(preamble: string): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];

    for (const line of preamble.split(/\r?\n/)) {
      const match = line.trim().match(/^\/\/\s*#require\s+"([^"\r\n]+)"\s*$/);
      if (!match) continue;

      dependencies.push({ name: match[1]! });
    }

    return dependencies;
  }

  private resolveDependencies(dependencies: ModuleDependency[], originToken: Token): boolean {
    const seen = new Set<string>();
    let success = true;

    for (const dependency of dependencies) {
      const { name } = dependency;
      if (name === 'core') continue;
      if (seen.has(name)) continue;
      seen.add(name);

      if (!this.resolveModule(name, originToken, true)) success = false;
    }

    return success;
  }

  private resolveModule(moduleName: string, originToken: Token, isDependency: boolean): boolean {
    const state = this.moduleStates.get(moduleName);
    if (state === 'resolved') return true;
    if (state === 'failed') {
      const error = this.moduleErrors.get(moduleName);
      if (error) this.reportError(error, originToken);
      return false;
    }

    // 走回正在解析的模組，代表循環依賴
    if (state === 'visiting') {
      const cycleStart = this.resolvingStack.indexOf(moduleName);
      const cycle = [...this.resolvingStack.slice(cycleStart), moduleName];
      this.reportError(Errors.CircularDependency, originToken, cycle.join(' -> '));
      this.moduleErrors.set(moduleName, Errors.CircularDependency);
      return false;
    }

    this.moduleStates.set(moduleName, 'visiting');
    this.resolvingStack.push(moduleName);

    try {
      const module = this.loadModule(moduleName);
      const success = this.resolveDependencies(module.dependencies, originToken);

      if (!success) {
        this.moduleStates.set(moduleName, 'failed');
        return false;
      }

      this.moduleCode += module.body.trim() + '\n';
      this.importedModule.push(moduleName);
      this.moduleStates.set(moduleName, 'resolved');

      return true;

    } catch (error) {
      const errorCode = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code : null;

      if (errorCode === 'MODULE_NOT_FOUND' || errorCode === 'ENOENT' || errorCode === 'ENOTDIR') {
        if (isDependency) {
          this.reportError(Errors.DependencyNotFound, originToken, this.resolvingStack.join(' -> '));
          this.moduleErrors.set(moduleName, Errors.DependencyNotFound);
        } else {
          this.reportError(Errors.ModuleNotFound, originToken);
          this.moduleErrors.set(moduleName, Errors.ModuleNotFound);
        }
      } else {
        this.reportError(Errors.ModuleLoadFailed, originToken);
        this.moduleErrors.set(moduleName, Errors.ModuleLoadFailed);
      }

      this.moduleStates.set(moduleName, 'failed');
      return false;
    } finally {
      this.resolvingStack.pop();
    }
  }

  private reportError(error: Errors, token: Token, details?: string): void {
    const report = getErrorReport(error, token);
    if (details) report.errorText += `：${details}`;
    this.errors.push(report);
  }
}

export { ModuleResolver };
