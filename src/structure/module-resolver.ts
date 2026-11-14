import { readFileSync } from 'node:fs';
import { Errors, getErrorReport } from '../constant/errors';
import { Token } from '../constant/token';
import type { CompileError, ModuleResolverResult, PathMapWithCore } from '../types/interfaces';

type ModuleState = 'visiting' | 'resolved' | 'failed';

class ModuleResolver {
  private errors: CompileError[] = [];
  private importedModule: string[] = [];
  private explicitImportedSet: Set<string> = new Set<string>();
  private moduleStates: Map<string, ModuleState> = new Map<string, ModuleState>();
  private moduleErrors: Map<string, Errors> = new Map();
  private resolvingStack: string[] = [];
  private moduleCode: string = '';
  constructor(private readonly includePath: PathMapWithCore) {}

  public init() {
    this.errors = [];
    this.importedModule = [];

    this.explicitImportedSet.clear();
    this.moduleStates.clear();
    this.moduleErrors.clear()
    this.resolvingStack = [];

    this.moduleCode = '';
  }

  private reportError(error: Errors, token: Token, details?: string): void {
    const report = getErrorReport(error, token);
    if (details) report.errorText += `：${details}`
    this.errors.push(report);
  }

  public resolve(explicitImportedModule: Token[]): ModuleResolverResult {

    // 載入核心模組
    const coreModuleCode = this.readModule(this.includePath.core);
    this.moduleCode += coreModuleCode.trim() + '\n';

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

      if (this.moduleStates.get(moduleName) === 'resolved') {
        continue;
      }

      this.resolveModule(moduleName, token, false);
    }

    return { 
      errors: this.errors, 
      moduleCode: this.moduleCode, 
      importedModule: this.importedModule
    };
  }

  private readModule(pathOrCode: string): string {
    return pathOrCode.startsWith('code:')
      ? pathOrCode.slice(5)
      : readFileSync(pathOrCode, 'utf-8');
  }

  private readModuleByName(name: string): string {
    const pathOrCode = this.includePath[name];

    if (!pathOrCode) throw Object.assign(new Error('MODULE_NOT_FOUND'), { code: 'MODULE_NOT_FOUND' });

    return this.readModule(pathOrCode);
  }

  private parsePreamble(source: string): {
    dependencies: string[];
    body: string;
  } {
    const dependencies: string[] = [];
    const dependencySet = new Set<string>();

    const lines = source.split(/\r?\n/);
    let preambleEnd = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!trimmed) {
        preambleEnd = i + 1;
        continue;
      }
      if (!trimmed.startsWith('//')) break;

      const match = trimmed.match(/^\/\/\s*#require\s+"([^"\r\n]+)"\s*$/);

      if (match) {
        const moduleName = match[1]!;

        if (moduleName !== 'core' && !dependencySet.has(moduleName)) {
          dependencySet.add(moduleName);
          dependencies.push(moduleName);
        }
      }

      preambleEnd = i + 1;
    }

    return {
      dependencies,
      body: lines.slice(preambleEnd).join('\n')
    }
  }

  private resolveModule(moduleName: string, originToken: Token, isDependency: boolean): boolean {
    if (this.moduleStates.get(moduleName) === 'resolved') return true;
    if (this.moduleStates.get(moduleName) === 'failed') {
      const error = this.moduleErrors.get(moduleName)
      if (error) this.reportError(error, originToken);
      return false;
    }

    // 走回正在解析的模組，代表循環依賴
    if (this.moduleStates.get(moduleName) === 'visiting') {
      const cycleStart = this.resolvingStack.indexOf(moduleName);
      const cycle = [...this.resolvingStack.slice(cycleStart), moduleName];
      this.reportError(Errors.CircularDependency, originToken, cycle.join(' -> '));
      this.moduleErrors.set(moduleName, Errors.CircularDependency);
      return false;
    }

    this.moduleStates.set(moduleName, 'visiting');
    this.resolvingStack.push(moduleName);

    let success = true;
    try {
      const source = this.readModuleByName(moduleName);
      const { dependencies, body } = this.parsePreamble(source);

      // 先解析所有依賴
      for (const dependency of dependencies) {
        if (!this.resolveModule(dependency, originToken, true)) success = false
      }

      // 只有所有依賴成功才加入程式碼
      if (success) {
        this.moduleCode += body.trim() + '\n';
        this.importedModule.push(moduleName);

        this.moduleStates.set(moduleName, 'resolved');
      } else {
        this.moduleStates.set(moduleName, 'failed');
      }
    } catch (error) {
      const errorCode = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : null;

      if (errorCode === 'MODULE_NOT_FOUND' || errorCode === 'ENOENT' || errorCode === 'ENOTDIR') {
        if (isDependency) {
          this.reportError(Errors.DependencyNotFound, originToken, this.resolvingStack.join(' -> '));
          this.moduleErrors.set(moduleName, Errors.DependencyNotFound);
        } else {
          this.reportError(Errors.ModuleNotFound, originToken);
          this.moduleErrors.set(moduleName, Errors.ModuleNotFound);
        }
      } else {
        this.reportError(Errors.ModuleLoadFailed, originToken)
        this.moduleErrors.set(moduleName, Errors.ModuleLoadFailed);
      }
      this.moduleStates.set(moduleName, 'failed');
      success = false;
    } finally {
      this.resolvingStack.pop();
    }

    return success;
  }

}

export { ModuleResolver };
