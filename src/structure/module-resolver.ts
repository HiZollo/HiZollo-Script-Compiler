import { readFileSync } from 'node:fs';
import { Errors, getErrorReport } from '../constant/errors';
import { Token } from '../constant/token';
import type { CompileError, ModuleResolverResult, PathMapWithCore } from '../types/interfaces';

class ModuleResolver {
  constructor(private readonly includePath: PathMapWithCore) {}

  public resolve(explicitImportedModule: Token[]): ModuleResolverResult {
    const errors: CompileError[] = [];
    const importedModule: string[] = [];
    const importedModuleSet = new Set<string>();
    let moduleCode = '';

    const reportError = (error: Errors, token: Token): void => {
      errors.push(getErrorReport(error, token));
    };

    // 載入核心模組
    const coreModuleCode = this.readModule(this.includePath.core);
    moduleCode += coreModuleCode.trim() + '\n';

    // 依照 Parser 提供的 Token 順序解析模組
    for (const token of explicitImportedModule) {
      const moduleName = token.value.slice(1, -1);

      // 不允許手動引入核心模組
      if (moduleName === 'core') {
        reportError(Errors.CantImportCoreModule, token);
        continue;
      }

      // 防止重複引入
      if (importedModuleSet.has(moduleName)) {
        reportError(Errors.AlreadyImported, token);
        continue;
      }

      const pathOrCode = this.includePath[moduleName];

      // 找不到模組
      if (!pathOrCode) {
        reportError(Errors.ModuleNotFound, token);
        continue;
      }

      // 讀取模組並建碼
      const code = this.readModule(pathOrCode);
      moduleCode += code.trim() + '\n';

      importedModuleSet.add(moduleName);
      importedModule.push(moduleName);
    }

    return { errors, moduleCode, importedModule };
  }

  private readModule(pathOrCode: string): string {
    return pathOrCode.startsWith('code:')
      ? pathOrCode.slice(5)
      : readFileSync(pathOrCode, 'utf-8');
  }
}

export { ModuleResolver };
