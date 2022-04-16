import type { Token } from '../constant/token';

class Identifier {
  public name: string = '';
  public level: number = 0;

  constructor(token: Token, level: number) {
    this.name = token.value;
    this.level = level;
  }
}

class IdentifierStack {
  public stack: Identifier[] = [];
  constructor() { }

  getId(name: string, level: number): Identifier | undefined {
    return this.stack.find(
      id => id.name === name && id.level == level
    );
  }

  push(id: Identifier): void {
    this.stack.push(id);
  }

  top(): Identifier | null {
    if (!this.stack.length) null;
    return this.stack[this.stack.length-1];
  }

  pop(): void {
    this.stack.pop();
  }


}

export { IdentifierStack, Identifier };
