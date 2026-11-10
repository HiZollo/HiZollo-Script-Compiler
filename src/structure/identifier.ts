import type { Token } from '../constant/token';

class Identifier {
  public readonly token: Token;
  public readonly name: string;
  public readonly level: number;
  public readonly byReference: boolean;
  public readonly generatedName: string;
  public readonly accessName: string;

  constructor(token: Token, level: number, byReference = false) {
    this.token = token;
    this.name = token.value;
    this.level = level;
    this.byReference = byReference;
    this.generatedName = `__hzs_C${level}_${this.name}`;
    this.accessName = this.byReference ? `${this.generatedName}._ref` : this.generatedName;
  }
}

class IdentifierTable {
  // Level -> Name -> Identifier
  private byScope = new Map<number, Map<string, Identifier>>();

  // Name -> Active Bindings
  private byName = new Map<string, Identifier[]>();

  getId(name: string, level: number): Identifier | undefined {
      return this.byScope.get(level)?.get(name);
  }

  getVisibleId(name: string): Identifier | undefined {
      const bindings = this.byName.get(name);
      return bindings?.at(-1);
  }

  declare(id: Identifier): boolean {
    let scope = this.byScope.get(id.level);

    if (!scope) {
      scope = new Map();
      this.byScope.set(id.level, scope);
    }

    if (scope.has(id.name)) {
      return false;
    }

    scope.set(id.name, id);

    let bindings = this.byName.get(id.name);

    if (!bindings) {
      bindings = [];
      this.byName.set(id.name, bindings);
    }

    bindings.push(id);

    return true;
  }

  leaveScope(level: number): void {
    const scope = this.byScope.get(level);
    if (!scope) return;

    for (const id of scope.values()) {
      const bindings = this.byName.get(id.name);

      if (!bindings || bindings.at(-1) !== id) {
        throw new Error(`Identifier index inconsistency: ${id.name}`);
      }

      bindings.pop();

      if (bindings.length === 0) {
        this.byName.delete(id.name);
      }
    }

    this.byScope.delete(level);
  }

  clear(): void {
    this.byScope.clear();
    this.byName.clear();
  }
}

export { IdentifierTable, Identifier };
