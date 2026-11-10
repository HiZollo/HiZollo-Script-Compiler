import type { Token } from '../constant/token';
import type { Identifier } from './identifier';

export class FunctionDeclaration {
  public readonly name: string;
  public readonly level: number;
  public readonly parameters: Identifier[];
  public readonly arity: number;
  public readonly token: Token;
  public readonly generatedName: string;

  constructor(token: Token, level: number, parameters: Identifier[]) {
    this.name = token.value;
    this.level = level;
    this.parameters = parameters;
    this.arity = parameters.length;
    this.token = token;
    this.generatedName = `__hzs_F${level}_${this.name}_${this.arity}`;
  }
}

export class FunctionTable {
  // Level -> Name -> Arity -> Declaration
  private byScope = new Map<number, Map<string, Map<number, FunctionDeclaration>>>();

  // Name -> Active declarations, ordered by scope
  private byName = new Map<string, FunctionDeclaration[]>();

  public getId(name: string, arity: number, level: number): FunctionDeclaration | undefined {
    return this.byScope.get(level)?.get(name)?.get(arity);
  }

  public getVisible(name: string, arity: number, currentLevel: number): FunctionDeclaration | undefined {
    // 必須同時搜尋 name 和 arity。
    // 內層沒有該 arity 時，繼續搜尋外層。
    for (let level = currentLevel; level >= 1; level--) {
      const found = this.getId(name, arity, level);
      if (found) return found;
    }

    return undefined;
  }

  public hasVisibleName(name: string, currentLevel: number): boolean {
    const declarations = this.byName.get(name);
    return declarations?.some(declaration => declaration.level <= currentLevel) ?? false;
  }

  public declare(declaration: FunctionDeclaration): boolean {
    let scope = this.byScope.get(declaration.level);

    if (!scope) {
      scope = new Map();
      this.byScope.set(declaration.level, scope);
    }

    let overloads = scope.get(declaration.name);

    if (!overloads) {
      overloads = new Map();
      scope.set(declaration.name, overloads);
    }

    // 同 scope + name + arity 不允許重複
    if (overloads.has(declaration.arity)) {
      return false;
    }

    overloads.set(declaration.arity, declaration);

    let bindings = this.byName.get(declaration.name);

    if (!bindings) {
      bindings = [];
      this.byName.set(declaration.name, bindings);
    }

    bindings.push(declaration);
    return true;
  }

  public leaveScope(level: number): void {
    const scope = this.byScope.get(level);
    if (!scope) return;

    for (const [name, overloads] of scope) {
      const bindings = this.byName.get(name);
      if (!bindings) {
        throw new Error(`Function index inconsistency: ${name}`);
      }

      for (const declaration of overloads.values()) {
        const index = bindings.lastIndexOf(declaration);

        if (index === -1) {
          throw new Error(`Function index inconsistency: ${name}/${declaration.arity}`);
        }

        bindings.splice(index, 1);
      }

      if (bindings.length === 0) {
        this.byName.delete(name);
      }
    }

    this.byScope.delete(level);
  }

  public clear(): void {
    this.byScope.clear();
    this.byName.clear();
  }
}

