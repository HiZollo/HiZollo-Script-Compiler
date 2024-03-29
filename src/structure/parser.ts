import { Scanner } from './scanner';
import { Identifier, IdentifierStack } from './identifier';
import { Token, Tokens } from '../constant/token';
import { Errors, ThrowError, skip } from '../constant/errors';
import { PathMap, ErrorOutput } from '../types/interfaces';
import { readFileSync } from 'fs';

class Parser {
  private getToken: () => Token | null;
  private source: string[];
  private tokens: Token[];
  private pointer: number;
  private endImport: boolean = false;
  private insideLoop: boolean = false;
  private nowLevel: number = 0;
  private idStack: IdentifierStack = new IdentifierStack();
  private includePath: PathMap;
  private disabledFunctions: string[];
  private importedModule: string[] = [];

  public nowToken: Token | null = null;
  public errorCount: number;
  public errorMessages: ErrorOutput;
  public result: string = '';
  public moduleCode: string = '';
  public transpiledCode: string = '';

  constructor(includePath: { [key: string]: string }, disabledFunctions: string[]) {
    this.includePath = includePath;
    this.disabledFunctions = disabledFunctions;
  }

  // 初始化 Parser
  public init(scanner: Scanner): void {
    // 將獲取 Token 的方式和匯入的 Scanner 綁在一起
    this.getToken = scanner.nextToken.bind(scanner);

    // 重新初始化
    this.source = scanner.getSource();
    this.tokens = [];
    this.pointer = -1;
    this.endImport = false;
    this.insideLoop = false;
    this.importedModule = [];

    this.nowToken = null;
    this.errorMessages = { textify: '', errors: [] };
    this.errorCount = 0;
    this.result = '';
    this.moduleCode = '';
    this.transpiledCode = '';
  }

  // 取得下一個 Token，會自動跳過註解
  public nextToken(): void {
    do {
      this.nowToken = this.getToken();
    } while (this.nowTokenIs(Tokens.Comments));
  }

  // 提供外部取得原始碼的方法
  public getSource(): string[] {
    return [...this.source];
  }

  // 載入所有 Token
  private loadAllToken(): void {
    while (true) {
      this.nextToken();
      if (!this.nowToken) break;
      this.tokens.push(this.nowToken);
    }
  }

  // 將指向某 Token 的指標移動至下一個
  private movePointerToNext(): void {
    this.pointer++;
    this.nowToken = this.tokens[this.pointer];
  }

  // 將指向某 Token 的指標移動至前一個
  private revert(): void {
    this.pointer--;
    this.nowToken = this.tokens[this.pointer];
  }

  // 檢查現在的 Token 是否為某些
  private nowTokenIs(...tokens: Tokens[]): boolean {
    if (!this.nowToken?.token) return false;
    return tokens.includes(this.nowToken?.token);
  }

  // 宣告變數
  private declareVariable(idToken: Token) {
    // 從識別字堆疊中尋找此區域是否有相同變數名稱
    const tmp = this.idStack.getId(idToken.value, this.nowLevel);
    // 如果沒有，宣告成功
    if (!tmp) return this.idStack.push(new Identifier(idToken, this.nowLevel));

    // 如果有，擲出變數重複宣告錯誤
    ThrowError(this, Errors.RedeclareIdentifier, idToken);
    skip(this, Tokens.Assignment);
  }

  // 檢查是否有禁用此函式
  private functionDisabled(idToken: Token) {
    return this.disabledFunctions.includes(idToken.value);
  }

  // 當離開一程式碼區域時做的清理動作
  private leaveBlock(): void {
    // 將識別字堆疊中此區域宣告的的識別字全部移除
    while (this.idStack.top() && this.idStack.top()?.level == this.nowLevel)
      this.idStack.pop();

    // 往外一層
    this.nowLevel--;
  }


  // 建碼函式
  private buildCode(code: string): void {
    this.transpiledCode += code;
  }

  private addModuleCode(code: string): void {
    this.moduleCode += code;
  }

  // 開始轉換
  public parse(): void {
    // 如果是空檔案就直接結束
    if (!this.source.filter(v => v.replace(/ +/, '')).length) return;

    // 載入所有 Token
    this.loadAllToken();
    // 設定目前原始碼巢狀深度
    this.nowLevel = 1;

    // 載入核心模組
    const coreModuleCode =
      this.includePath['core'].startsWith('code:')
      ? this.includePath['core'].slice(5)
      : readFileSync(this.includePath['core'], 'utf-8');

    this.addModuleCode(coreModuleCode.trim() + '\n');

    // 如果 Scanner 不小心掃到尾巴，這裡把他拿掉
    // @ts-ignore
    if (this.tokens[this.tokens.length-1].value === -1 || this.tokens[this.tokens.length-1].value === '-1') this.tokens.pop();

    // 指標開始移動
    this.movePointerToNext();

    // 解析引入模組區
    while (this.nowToken && !this.endImport) {
      this.Include();
    }

    // 程式正式開始的建碼
    this.buildCode("_start();");

    // 解析一般區
    while (this.nowToken) {
      this.Statement();
    }

    // 程式結尾處的建碼
    this.buildCode("_end();\n");
    this.buildCode("/* This code is generated by Official HiZollo Script compiler */");
    // 在程式中夾帶模組資訊，方便開套模組使用
    const moduleList = this.importedModule.map(m => `${m}: true`).join(',');
    const k = `globalThis.__hzs__={__module__:{${moduleList}},__data__:{}};`;

    this.result = `${k}${this.moduleCode}${this.transpiledCode}`

    // 清空識別字堆疊，以利第二次使用
    while (this.idStack.top()) this.idStack.pop();
  }

  /** 以下全為規則 **/

  private Include(): void {
    if (this.nowTokenIs(Tokens.Import)) {
      this.movePointerToNext();
      if (this.nowTokenIs(Tokens.String)) {
        // @ts-ignore
        const moduleName = this.nowToken.value.slice(1, -1)

        // 不能手動引入核心模組
        if (moduleName === 'core') {
          ThrowError(this, Errors.CantImportCoreModule, this.nowToken);
          this.revert();
          skip(this, Tokens.Include);
          return;
        }

        // importedModule 存有已經被引入的模組名稱，防止使用者重複引入
        if (this.importedModule.includes(moduleName)) {
          ThrowError(this, Errors.AlreadyImported, this.nowToken);
          this.revert();
          skip(this, Tokens.Include);
          return;
        }

        const pathOrCode = this.includePath[moduleName];
        // 找不到模組
        if (!pathOrCode) {
          ThrowError(this, Errors.ModuleNotFound, this.nowToken);
          this.revert();
          skip(this, Tokens.Include);
          return;
        }

        // 解析究竟是模組路徑或模組原始碼
        const moduleCode = pathOrCode.startsWith('code:')
          ? pathOrCode.slice(5)
          : readFileSync(pathOrCode, 'utf-8');

        // 建碼
        this.addModuleCode(moduleCode.trim() + '\n');
        // 將模組放入已引入的模組清單
        this.importedModule.push(moduleName);
        this.movePointerToNext();
        return;
      }
      this.revert();
      ThrowError(this, Errors.MissingModuleName, this.nowToken);
      skip(this, Tokens.Include);
      return;
    }

    // 結束引入階段（引入敘述只能放在程式開頭）
    this.endImport = true;
  }

  private Statement(): void {
    if (!this.nowToken) return;

    // 當遇到 Import Token 時，因匯入敘述只能放在程式開頭，便報錯
    if (this.nowTokenIs(Tokens.Import)) {
      ThrowError(this, Errors.LateImport, this.nowToken);
      skip(this, Tokens.Statement);
      return;
    }

    // 遇到識別字
    if (this.nowTokenIs(Tokens.Identifier)) {
      const nowId = this.nowToken;
      this.movePointerToNext();

      // 宣告敘述
      if (this.nowTokenIs(Tokens.Declare)) {
        // 宣告變數
        this.declareVariable(nowId);
        // 建碼
        this.buildCode(`let ${makeId(nowId.value)}=`);
        this.movePointerToNext();
        // 檢查宣告敘述
        this.Declaration();
        this.buildCode(";")
        return;
      }

      // 指定敘述
      if (this.nowTokenIs(Tokens.Assign)) {
        // 往前移一格以對識別字做檢查
        this.revert();
        this.Identifier();
        this.movePointerToNext();
        // 檢查指定敘述
        this.Assignment();
        this.buildCode(";");
        return;
      }

      // 交換敘述
      if (this.nowTokenIs(Tokens.Swap)) {
        // 往前移一格已對識別字做檢查
        this.revert();
        this.Identifier(true, false); // 檢查但不建碼
        this.movePointerToNext();

        if (!this.nowTokenIs(Tokens.Identifier)) {
          this.revert();
          ThrowError(this, Errors.MissingIdentifier, this.nowToken);
          skip(this, Tokens.Statement);
          return;
        }

        const secondToken = this.nowToken;
        this.Identifier(true, false); // 檢查但不建碼

        // 建碼
        const tmp = makeId(`swapOp_tmp_$${nowId.value}$${secondToken.value}`);
        this.buildCode("{");
        this.buildCode(`const ${tmp}=${makeId(nowId.value)};`);
        this.buildCode(`${makeId(nowId.value)}=${makeId(secondToken.value)};`);
        this.buildCode(`${makeId(secondToken.value)}=${tmp};`);
        this.buildCode("}");
        return;
      }

      // 函式敘述
      if (this.nowTokenIs(Tokens.LeftBracket)) {
        this.revert();
        // 檢查函式
        this.Function();
        this.buildCode(";");
        return;
      }

      // 若非以上三種，即為錯誤敘述，往前回到識別字 Token 後丟出錯誤
      this.revert();
      ThrowError(this, Errors.UnknownIdentifier, this.nowToken);
      skip(this, Tokens.Statement);
      return;
    }

    // 左大括號表示為 If 敘述
    if (this.nowTokenIs(Tokens.LeftCurlyBracket)) {
      this.movePointerToNext();
      // 檢查 If 敘述
      this.If();
      return;
    }

    // 左中括號表示為 For 敘述
    if (this.nowTokenIs(Tokens.LeftSquareBracket)) {
      this.movePointerToNext();
      // 檢查 For 敘述
      this.For();
      return;
    }

    // break 或 continue，只能使用在迴圈內
    if (this.nowTokenIs(Tokens.Arrow)) {
      if (this.insideLoop) {
        this.movePointerToNext();
        if (this.nowTokenIs(Tokens.Bar)) {
          this.buildCode("break;");
          this.movePointerToNext();
          return;
        }
        this.buildCode("continue;");
        return;
      }

      ThrowError(this, Errors.InappropriateBreakStatement, this.nowToken);
      skip(this, Tokens.Statement);
      return;
    }

    // 輸出敘述
    if (this.nowTokenIs(Tokens.Write)) {
      this.movePointerToNext();
      this.Print();
      this.buildCode(";");
      return;
    }

    ThrowError(this, Errors.UnknownStatement, this.nowToken);
  }

  // 宣告敘述檢查
  private Declaration(): void {
    // 宣告符號右邊必須為數字，檢查是否為數字
    this.Number();
  }

  // 指定敘述檢查
  private Assignment(): void {
    this.buildCode("=");
    // 檢查右邊是否為合法表達式
    this.Expression();
  }

  // 函式敘述檢查
  private Function(): void {
    // 檢查函式是否被禁用
    if (this.functionDisabled(this.nowToken)) {
      ThrowError(this, Errors.UseDisabledFunction, this.nowToken);
      skip(this, Tokens.Function)
      return;
    }

    this.buildCode(`${this.nowToken.value}`)
    this.movePointerToNext();

    // 檢查是否跟隨左括號
    if (this.nowTokenIs(Tokens.LeftBracket)) {
      this.buildCode(`(`);
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingLeftBracket, this.nowToken);
      skip(this, Tokens.Function)
      return;
    }

    // 碰到右括號表示函式無參數，建碼後結束
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.buildCode(")");
      this.movePointerToNext();
      return;
    }

    // 檢查參數列
    this.ParameterList();

    // 如果這時還不是右括號，表示原程式碼缺少了括號
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.buildCode(")");
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightBracket, this.nowToken);
      skip(this, Tokens.Function);
    }
  }

  // 檢查參數列
  private ParameterList(): void {
    // 檢查參數
    this.Parameter();

    // 如果下一格是逗號，表示還有下一個參數，一直檢查到沒有為止
    while (this.nowTokenIs(Tokens.Comma)) {
      this.buildCode(',');
      this.movePointerToNext();
      this.Parameter();
    }
  }

  // 檢查參數
  private Parameter(): void {
    // 如果是字串就檢查字串
    if (this.nowTokenIs(Tokens.String)) {
      this.String();
      return;
    }

    // 否則檢查是否為合法表達式
    this.Expression();
    return;
  }

  // 檢查 If 敘述
  private If(): void {
    // 檢查是否為合法 If 開頭
    this.IfHead();

    // 必須接續左括號表示 If 區塊
    if (this.nowTokenIs(Tokens.LeftBracket)) {
      this.buildCode("{");
      // 進入區塊
      this.nowLevel++;
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingLeftBracket, this.nowToken);
      skip(this, Tokens.If);
    }

    // 只要是這六種，就表示是一個敘述，進行檢查
    // 否則就進行 If 結尾的檢查
    while (this.nowTokenIs(Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Arrow, Tokens.Import)) {
      this.Statement();
    }

    // 要用右括號為 If 做結尾
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.buildCode('}');
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightBracket, this.nowToken);
      skip(this, Tokens.If);
    }

    // 離開區塊的清理動作
    this.leaveBlock();

    // 如果碰到斜線（除號），表示有 else if 或 else 區塊
    if (this.nowTokenIs(Tokens.Divide)) {
      this.movePointerToNext();
      // 斜線 + 左大括號表示 else if
      if (this.nowTokenIs(Tokens.LeftCurlyBracket)) {
        this.buildCode('else ');
        this.movePointerToNext();
        this.If();
        return;
      }
      // 否則為 else
      this.Else();
    }

  }

  // 檢查 If 開頭
  private IfHead(): void {
    this.buildCode("if(");
    // 檢查條件句是否正確
    this.Condition();

    // 必須以右大括號結尾
    if (this.nowTokenIs(Tokens.RightCurlyBracket)) {
      this.buildCode(')');
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightCurlyBracket, this.nowToken);
      skip(this, Tokens.IfHead);
    }
  }

  // 檢查條件句
  private Condition(): void {
    // 檢查關係運算子左邊是否為合法表達式
    this.Expression();

    // 必須接續關係運算子，否則錯誤
    if (this.nowTokenIs(Tokens.LessThan, Tokens.GreaterThan, Tokens.LessOrEqual, Tokens.GreaterOrEqual, Tokens.Equal, Tokens.Inequal)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.InvalidComparation, this.nowToken);
      skip(this, Tokens.Condition);
      return;
    }

    // 檢查關係運算子右邊是否為合法表達式
    this.Expression();
  }

  // 檢查 Else
  private Else(): void {
    // 以左括號開始
    if (this.nowTokenIs(Tokens.LeftBracket)) {
      // 進入區塊
      this.nowLevel++;
      this.buildCode('else{');
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingLeftBracket, this.nowToken);
      skip(this, Tokens.Else);
    }

    // 只要是這六種，就表示是一個敘述，進行檢查
    // 否則就進行 Else 結尾的檢查
    while (this.nowTokenIs(Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Arrow, Tokens.Import)) {
      this.Statement();
    }

    // 要用右括號做結尾
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.buildCode('}');
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightBracket, this.nowToken);
    }

    // 離開區塊的清理動作
    this.leaveBlock();

  }

  // 檢查 For
  private For(): void {
    // 進入區塊
    this.nowLevel++;
    // 檢查 For 的開頭
    this.ForHead();


    // 必需接續左括號表示 For 區塊
    if (this.nowTokenIs(Tokens.LeftBracket)) {
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingLeftBracket, this.nowToken);
      skip(this, Tokens.Statement);
    }

    this.buildCode("{");

    // 只要是這六種，就表示是一個敘述，進行檢查
    // 否則就進行 For 結尾的檢查
    while (this.nowTokenIs(Tokens.Identifier, Tokens.LeftCurlyBracket, Tokens.LeftSquareBracket, Tokens.Write, Tokens.Arrow, Tokens.Import)) {
      this.insideLoop = true;
      this.Statement();
      this.insideLoop = false;
    }

    // 以右括號表示區塊結束
    if (this.nowTokenIs(Tokens.RightBracket)) {
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightBracket, this.nowToken);
    }

    this.buildCode("}");
    // 離開區塊的清理動作
    this.leaveBlock();
  }

  // For 開頭的檢查
  private ForHead(): void {
    // 作為遍歷迴圈的變數
    const indexVar = this.nowToken;
    this.buildCode(`for(let `);

    // 檢查識別字，但不做是否宣告的檢查
    this.Identifier(false);
    if (!indexVar) {
      skip(this, Tokens.ForHead);
      return;
    }

    // 檢查是否為指定運算子
    if (this.nowTokenIs(Tokens.Assign)) {
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingAssignOperator, this.nowToken);
      skip(this, Tokens.ForHead);
    }

    this.buildCode("=");
    // 檢查箭頭左邊是否為合法表達式
    this.Expression();
    this.buildCode(`;${makeId(indexVar.value)}<=`);

    // 檢查箭頭有沒有好好寫
    if (this.nowTokenIs(Tokens.Arrow)) {
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingArrow, this.nowToken);
      skip(this, Tokens.ForHead);
      return;
    }

    // 檢查箭頭右邊是否為合法表達式
    this.Expression();
    this.buildCode(`;++${makeId(indexVar.value)})`);

    // 以右括號做結束
    if (this.nowTokenIs(Tokens.RightSquareBracket)) {
      this.movePointerToNext();
    } else {
      ThrowError(this, Errors.MissingRightSquareBracket, this.nowToken);
      skip(this, Tokens.ForHead);
    }
    // 此時才宣告變數，避免有人在箭頭兩邊的敘述就使用遍歷迴圈的變數但檢查不到
    this.declareVariable(indexVar);
  }

  // 印出敘述
  private Print(): void {
    this.buildCode("_write(");

    // 必須接字串或表達式
    if (this.nowTokenIs(Tokens.String))
      this.String();
    else
      this.Expression();

    this.buildCode(")");
  }

  // 檢查是否為表達式
  private Expression(): void {
    // 檢查開頭的正負號
    if (this.nowTokenIs(Tokens.Plus, Tokens.Minus)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
    }
    // 檢查項目是否正確
    // 項目是由乘除號連接的一個以上的因子
    // 因子則是計算的最小單位
    this.Term();

    // 如果是加減號，檢查另外一邊是否也是項目
    while (this.nowTokenIs(Tokens.Plus, Tokens.Minus)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
      this.Term();
    }
  }

  // 檢查項目
  private Term(): void {
    // 檢查是否為計算因子
    this.Factor();
    // 如果是乘除號，檢查另外一邊是否也是計算因子
    while (this.nowTokenIs(Tokens.Multiply, Tokens.Divide)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
      this.Factor()
    }
  }

  // 計算因子
  private Factor(): void {
    // 識別字開頭，可能是函數或變數
    if (this.nowTokenIs(Tokens.Identifier)) {
      this.movePointerToNext();
      // 函數
      if (this.nowTokenIs(Tokens.LeftBracket)) {
        this.revert();
        // 檢查函數
        this.Function();
        return;
      }

      // 否則回頭檢查識別字
      this.revert();
      this.Identifier();
      return;
    }

    // 數字
    if (this.nowTokenIs(Tokens.Number)) {
      this.Number();
      return;
    }

    // 如果碰到左括號
    if (this.nowTokenIs(Tokens.LeftBracket)) {
      this.buildCode('(');
      this.movePointerToNext();
      // 檢查是否為合法表達式
      this.Expression();
      // 左右括號必須成對
      if (this.nowTokenIs(Tokens.RightBracket)) {
        this.buildCode(')');
        this.movePointerToNext();
        return;
      }
      this.revert();
      ThrowError(this, Errors.MissingRightBracket, this.nowToken);
      skip(this, Tokens.Factor);
      return;
    }

    this.revert();
    // 上面全部都不是的話，丟出缺少左括號錯誤
    ThrowError(this, Errors.MissingLeftBracket, this.nowToken);
    skip(this, Tokens.Factor);

  }

  // 檢查識別字
  private Identifier(checkExist = true, build = true, idToken = this.nowToken): void {
    // 如果是識別字的話
    if (idToken?.token === Tokens.Identifier) {
      // 建碼
      if (build) this.buildCode(makeId(idToken.value));
      this.movePointerToNext();
      // 如果不用檢查是否宣告，結束
      if (!checkExist) return;
      // 函數都是從外部模組來的，不用檢查是否存在
      if (this.nowTokenIs(Tokens.LeftBracket)) return;

      this.revert();
      let identifier: Identifier | undefined;
      let level = this.nowLevel;
      // 從識別字堆疊中開始，尋找每一層有沒有宣告過此變數
      while (level > 0 && !identifier) {
        identifier = this.idStack.getId(idToken.value, level--);
      }

      // 找不到就丟出未定義錯誤
      if (!identifier) {
        ThrowError(this, Errors.IdentifierNotDefined, this.nowToken);
        return;
      }

      this.movePointerToNext();
      return;
    }

    // 丟出遺漏識別字錯誤
    ThrowError(this, Errors.MissingIdentifier, this.nowToken);
  }

  // 檢查數字
  private Number(): void {
    // 是數字就建碼
    if (this.nowTokenIs(Tokens.Number)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
      return;
    }
    // 丟出遺漏數字錯誤
    ThrowError(this, Errors.MissingNumber, this.nowToken);
  }

  // 檢查字串
  private String(): void {
    // 是字串就建碼
    if (this.nowTokenIs(Tokens.String)) {
      let { value } = this.nowToken;

      // 判斷是否為「\」結尾
      value = value.endsWith(`\\"`) ? value.slice(0, -2) + `\\\\"` : value;
      this.buildCode(value);
      this.movePointerToNext();
      return;
    }
    // 否則丟出遺漏字串錯誤
    ThrowError(this, Errors.MissingString, this.nowToken);
    skip(this, Tokens.Statement);
  }

}

// 避免撞名而格式化識別字名稱的函式
function makeId(identifierName: string): string {
  return `__hzs_C_${identifierName}`;
}

export { Parser }
