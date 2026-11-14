import { Scanner } from './scanner';
import { Identifier, IdentifierTable } from './identifier';
import { followTokenSet, statementBeginning, Token, Tokens } from '../constant/token';
import { Errors, getErrorReport } from '../constant/errors';
import type { PathMapWithCore, ParserResult, CompileError } from '../types/interfaces';
import { readFileSync } from 'node:fs';
import { FunctionDeclaration, FunctionTable } from './function';
import { ExpressionParser } from './expression-parser';

class Parser {
  private getToken: () => Token | null = () => null;
  private source: string[] = [];
  private tokens: Token[] = [];
  private pointer: number = -1;
  private endImport: boolean = false;
  private insideLoop: boolean = false;
  private insideFunction: boolean = false;
  private nowLevel: number = 0;
  private idTable: IdentifierTable = new IdentifierTable();
  private functionTable: FunctionTable = new FunctionTable();
  private expressionParser: ExpressionParser;
  private includePath: PathMapWithCore;
  private disabledModuleFunctions: string[];
  private importedModule: string[] = [];
  private bootstrapCode: string;
  private tempCounter: bigint = 0n;

  public nowToken: Token | null = null;
  public errors: CompileError[] = [];
  public result: string = '';
  public moduleCode: string = '';
  public transpiledCode: string = '';

  constructor(includePath: PathMapWithCore, disabledFunctions: string[], bootstrapCode: string) {
    this.includePath = includePath;
    this.disabledModuleFunctions = disabledFunctions;
    this.bootstrapCode = bootstrapCode
    this.expressionParser = new ExpressionParser({
      current: () => this.nowToken,
      peek: () => this.tokens[this.pointer + 1] ?? null,
      advance: () => this.movePointerToNext(),
      report: (error, token) => { this.reportError(error, token); },
      recover: (nonterminal) => { this.recover(nonterminal); },
      getIdentifier: (name) => this.getResolvedIdentifier(name),
      isModuleFunctionDisabled: (name) => this.functionDisabled(name),
      getFunction: (name, arity) => this.functionTable.getVisible(name, arity, this.nowLevel),
      hasFunction: (name) => this.functionTable.hasVisibleName(name, this.nowLevel)
    });
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
    this.insideFunction = false;
    this.importedModule = [];
    this.tempCounter = 0n;

    this.nowToken = null;
    this.errors = [];
    this.result = '';
    this.moduleCode = '';
    this.transpiledCode = '';

    this.idTable.clear();
    this.functionTable.clear();
    this.nowLevel = 0;
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
    this.nowToken = this.tokens[this.pointer] ?? null;
  }

  // 將指向某 Token 的指標移動至前一個
  private revert(): void {
    this.pointer--;
    this.nowToken = this.tokens[this.pointer] ?? null;
  }

  // 檢查現在的 Token 是否為某些
  private nowTokenIs(...tokens: Tokens[]): boolean {
    if (!this.nowToken) return false;
    return tokens.includes(this.nowToken.token);
  }

  // 宣告變數
  private declareVariable(identifier: Identifier) {
    // 嘗試宣告變數，如果此區域有相同變數名稱會失敗
    const success = this.idTable.declare(identifier);
    // 宣告成功就結束
    if (success) return;

    // 如果有，擲出變數重複宣告錯誤
    this.reportError(Errors.RedeclareIdentifier, identifier.token);
    this.recover(Tokens.Declaration);
  }

  // 檢查指定變數的層級
  private getResolvedIdentifier(name: string): Identifier | undefined {
    return this.idTable.getVisibleId(name);
  }

  // 建立暫時變數名稱
  private createTempName(): string {
    return `__hzs_T${this.tempCounter++}`;
  }

  // 檢查是否有禁用此函式
  private functionDisabled(idToken: Token) {
    return this.disabledModuleFunctions.includes(idToken.value);
  }

  // 檢查是否為 Statement 的開頭
  private isStartOfStatement(token: Token | null = this.nowToken): boolean {
    if (!token) return false
    return statementBeginning.includes(token.token)
  }

  // 當離開一程式碼區域時做的清理動作
  private leaveBlock(): void {
    // 將識別字堆疊中此區域宣告的的識別字全部移除
    this.idTable.leaveScope(this.nowLevel);
    this.functionTable.leaveScope(this.nowLevel);

    // 往外一層
    this.nowLevel--;
  }

  // 拋出編譯錯誤
  private reportError(errorType: Errors, token: Token | null): void {
    if (!token) {
      const lastToken = this.tokens[this.tokens.length - 1]
      if (!lastToken) return;
      token = lastToken
    }
    const report = getErrorReport(errorType, token)
    this.errors.push(report)
    this.movePointerToNext();
  }

  // 從編譯錯誤中回復
  private recover(target: Tokens) {
    if (!this.nowToken) return;
    const followToken = followTokenSet[target];
    if (!followToken) return;

    while (this.nowToken && !followToken.includes(this.nowToken.token)) {
      this.movePointerToNext()
    }
  }

  // 建碼函式
  private buildCode(code: string): void {
    this.transpiledCode += code;
  }

  private addModuleCode(code: string): void {
    this.moduleCode += code;
  }

  // 開始轉換
  public parse(): ParserResult {
    // 如果是空檔案就直接結束
    if (!this.source.filter(v => v.trim().length > 0).length) return { errors: [], transpiledCode: '', explicitImportedModule: [] }

    // 載入所有 Token
    this.loadAllToken();
    if (this.tokens.length === 0) return { errors: [], transpiledCode: '', explicitImportedModule: [] }

    // 設定目前原始碼巢狀深度
    this.nowLevel = 1;

    // 載入核心模組
    const coreModuleCode =
      this.includePath['core'].startsWith('code:')
      ? this.includePath['core'].slice(5)
      : readFileSync(this.includePath['core'], 'utf-8');

    this.addModuleCode(coreModuleCode.trim() + '\n');

    // 如果 Scanner 不小心掃到尾巴，這裡把他拿掉
    const lastToken = this.tokens[this.tokens.length - 1]
    // @ts-ignore
    if (!lastToken || lastToken.value === -1 || lastToken.value === '-1') this.tokens.pop();

    // 指標開始移動
    this.movePointerToNext();

    // 解析引入模組區
    while (this.nowToken && !this.endImport) {
      this.Include();
    }

    // 程式正式開始的建碼
    this.buildCode("_start();try{");

    // 解析一般區
    while (this.nowToken) {
      this.Statement();
    }

    // 程式結尾處的建碼
    this.buildCode("}catch(e){_panic(e);}finally{_end();}\n");
    this.buildCode("/* Generated by the official HiZollo Script compiler */");

    // 生成 Runtime Bootstrap
    const moduleList = JSON.stringify(Object.fromEntries(this.importedModule.map(name => [name, true])))
    const disabledModuleFunctionsList = JSON.stringify(Object.fromEntries(this.disabledModuleFunctions.map(name => [name, true])))
    const bootstrapCode = this.bootstrapCode
      .replace("__HZS_MODULE_LIST__", moduleList)
      .replace("__HZS_DISABLED_MODULE_FUNCTIONS_LIST__", disabledModuleFunctionsList)

    this.result = `${bootstrapCode}${this.moduleCode}${this.transpiledCode}`

    return {
      errors: this.errors,
      transpiledCode: this.transpiledCode,
      explicitImportedModule: this.importedModule
    }
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
          this.reportError(Errors.CantImportCoreModule, this.nowToken);
          this.revert();
          this.recover(Tokens.Include);
          return;
        }

        // importedModule 存有已經被引入的模組名稱，防止使用者重複引入
        if (this.importedModule.includes(moduleName)) {
          this.reportError(Errors.AlreadyImported, this.nowToken);
          this.revert();
          this.recover(Tokens.Include);
          return;
        }

        const pathOrCode = this.includePath[moduleName];
        // 找不到模組
        if (!pathOrCode) {
          this.reportError(Errors.ModuleNotFound, this.nowToken);
          this.revert();
          this.recover(Tokens.Include);
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
      this.reportError(Errors.MissingModuleName, this.nowToken);
      this.recover(Tokens.Include);
      return;
    }

    // 結束引入階段（引入敘述只能放在程式開頭）
    this.endImport = true;
  }

  private Statement(): void {
    if (!this.nowToken) return;

    // 當遇到 Import Token 時，因匯入敘述只能放在程式開頭，便報錯
    if (this.nowTokenIs(Tokens.Import)) {
      this.reportError(Errors.LateImport, this.nowToken);
      this.recover(Tokens.Statement);
      return;
    }

    // 遇到數字
    if (this.nowTokenIs(Tokens.Number)) {
      this.Expression()
      this.buildCode(";")
      return
    }

    // 遇到識別字
    if (this.nowTokenIs(Tokens.Identifier)) {
      const nowId = this.nowToken;
      this.movePointerToNext();

      // 宣告敘述
      if (this.nowTokenIs(Tokens.Declare)) {
        // 建碼
        const identifier = new Identifier(nowId, this.nowLevel);
        this.buildCode(`let ${identifier.generatedName}=`);
        this.movePointerToNext();
        // 檢查宣告敘述
        this.Declaration();
        this.buildCode(";")
        // 宣告變數
        this.declareVariable(identifier);
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
          this.reportError(Errors.MissingIdentifier, this.nowToken);
          this.recover(Tokens.Statement);
          return;
        }

        const secondToken = this.nowToken;
        this.Identifier(true, false); // 檢查但不建碼

        // 建碼
        const identifier1 = this.getResolvedIdentifier(nowId.value);
        const identifier2 = this.getResolvedIdentifier(secondToken.value);

        if (!identifier1 || !identifier2) return;

        const tmp = this.createTempName();
        const id1 = identifier1.accessName;
        const id2 = identifier2.accessName;

        this.buildCode("{");
        this.buildCode(`const ${tmp}=${id1};`);
        this.buildCode(`${id1}=${id2};`);
        this.buildCode(`${id2}=${tmp};`);
        this.buildCode("}");
        return;
      }

      // 若非以上，視為表達式，往前回到識別字 Token 後開始解析
      this.revert();
      this.Expression();
      this.buildCode(";");
      return;
    }

    // 左大括號表示為 If 敘述
    if (this.nowTokenIs(Tokens.LeftCurlyBracket)) {
      this.movePointerToNext();
      // 檢查 If 敘述
      this.If();
      return;
    }

    // 左中括號表示為迴圈
    if (this.nowTokenIs(Tokens.LeftSquareBracket)) {
      this.movePointerToNext();
      // 檢查迴圈敘述
      this.Loop();
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

      this.reportError(Errors.InappropriateBreakStatement, this.nowToken);
      this.recover(Tokens.Statement);
      return;
    }

    // 輸出敘述
    if (this.nowTokenIs(Tokens.Write)) {
      this.movePointerToNext();
      this.Print();
      this.buildCode(";");
      return;
    }

    // $ 表示宣告自訂函數、返回敘述或呼叫自訂函式
    if (this.nowTokenIs(Tokens.Dollar)) {
      this.movePointerToNext();

      if (this.nowTokenIs(Tokens.ReturnArrow)) {
        this.ReturnStatement();
        return;
      }

      if (!this.nowTokenIs(Tokens.Identifier)) {
        this.reportError(Errors.MissingIdentifier, this.nowToken);
        this.recover(Tokens.Statement);
        return;
      }

      this.movePointerToNext();

      // 宣告函式
      if (this.nowTokenIs(Tokens.Declare)) {
        this.revert();
        this.FunctionDeclaration();
        return;
      }

      // Custom Function Call
      // 還原至 $ Token，交給 ExpressionParser
      this.revert();
      this.revert();
      this.Expression();
      this.buildCode(';');
      return;
    }

    this.reportError(Errors.UnknownStatement, this.nowToken);
  }

  // 宣告敘述檢查
  private Declaration(): void {
    // 檢查右邊是否為合法表達式
    this.Expression();
  }

  // 檢查 If 敘述
  private If(): void {
    // 檢查是否為合法 If 開頭
    this.IfHead();

    // 進入區塊
    this.nowLevel++;

    try {
      // 必須接續左括號表示 If 區塊
      if (this.nowTokenIs(Tokens.LeftBracket)) {
        this.buildCode("{");
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingLeftBracket, this.nowToken);
        this.recover(Tokens.If);
      }

      // 如果是一個敘述就解析
      // 否則就進行 If 結尾的檢查
      while (this.isStartOfStatement(this.nowToken)) {
        this.Statement();
      }

      // 要用右括號為 If 做結尾
      if (this.nowTokenIs(Tokens.RightBracket)) {
        this.buildCode('}');
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingRightBracket, this.nowToken);
        this.recover(Tokens.If);
      }
    } finally {
      // 離開區塊的清理動作
      this.leaveBlock();
    }

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
    this.Expression();

    // 必須以右大括號結尾
    if (this.nowTokenIs(Tokens.RightCurlyBracket)) {
      this.buildCode(`)`);
      this.movePointerToNext();
    } else {
      this.reportError(Errors.MissingRightCurlyBracket, this.nowToken);
      this.recover(Tokens.IfHead);
    }
  }

  // 檢查 Else
  private Else(): void {
    // 進入區塊
    this.nowLevel++;

    try {
      // 以左括號開始
      if (this.nowTokenIs(Tokens.LeftBracket)) {
        this.buildCode('else{');
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingLeftBracket, this.nowToken);
        this.recover(Tokens.Else);
      }

      // 如果是一個敘述就解析
      // 否則就進行 Else 結尾的檢查
      while (this.isStartOfStatement()) {
        this.Statement();
      }

      // 要用右括號做結尾
      if (this.nowTokenIs(Tokens.RightBracket)) {
        this.buildCode('}');
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingRightBracket, this.nowToken);
      }
    } finally {
      // 離開區塊的清理動作
      this.leaveBlock();
    }
  }

  // 檢查迴圈
  private Loop(): void {
    // 進入區塊
    this.nowLevel++;
    const prevLoopState = this.insideLoop;

    try {
      // 檢查迴圈種類
      if (this.nowTokenIs(Tokens.Arrow)) {
        this.InfiniteLoopHead();
      } else if (this.nowTokenIs(Tokens.LeftCurlyBracket)) {
        this.WhileHead();
      } else if (this.nowTokenIs(Tokens.Identifier)) {
        this.ForHead();
      } else {
        this.reportError(Errors.UnknownLoopSyntax, this.nowToken);
        this.recover(Tokens.LoopHead)
      }

      // 檢查結尾的 ] 
      if (this.nowTokenIs(Tokens.RightSquareBracket)) {
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingRightSquareBracket, this.nowToken);
        this.recover(Tokens.Loop);
        return; // 少了 ] 就放棄這個迴圈
      }

      // 檢查區塊開始
      if (this.nowTokenIs(Tokens.LeftBracket)) {
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingLeftBracket, this.nowToken);
        this.recover(Tokens.Loop);
        return;
      }

      this.buildCode("{");

      // 進入迴圈
      this.insideLoop = true;
      // 如果是一個敘述就解析
      // 否則就進行 For 結尾的檢查
      while (this.isStartOfStatement()) {
        this.Statement();
      }

      // 以右括號表示區塊結束
      if (this.nowTokenIs(Tokens.RightBracket)) {
        this.movePointerToNext();
      } else {
        this.reportError(Errors.MissingRightBracket, this.nowToken);
      }

      this.buildCode("}");
    } finally {
      // 退出本層迴圈
      this.insideLoop = prevLoopState;
      // 離開區塊的清理
      this.leaveBlock();
    }
  }

  // 無窮迴圈開頭的檢查
  private InfiniteLoopHead(): void {
    this.movePointerToNext();
    this.buildCode(`while(true)`);
  }

  // 條件迴圈開頭的檢查
  private WhileHead(): void {
    this.movePointerToNext();
    this.buildCode("while(");

    this.Expression();

    // 必須以 } 結束條件
    if (this.nowTokenIs(Tokens.RightCurlyBracket)) {
      this.movePointerToNext();
    } else {
      this.reportError(Errors.MissingRightCurlyBracket, this.nowToken);
      this.recover(Tokens.LoopHead);
      return;
    }

    this.buildCode(`)`);
  }

  // For 開頭的檢查
  private ForHead(): void {
    // 作為遍歷迴圈的變數
    const indexIdentifier = new Identifier(this.nowToken!, this.nowLevel)
    this.buildCode(`for(let ${indexIdentifier.generatedName}`);
    // 因為這裡不用檢查識別字是否存在，只需要建碼，所以直接吃掉這個 Token
    this.movePointerToNext()

    // 檢查是否為指定運算子
    if (this.nowTokenIs(Tokens.Assign)) {
      this.movePointerToNext();
    } else {
      this.reportError(Errors.MissingAssignOperator, this.nowToken);
      this.recover(Tokens.LoopHead);
    }

    this.buildCode("=");
    // 檢查箭頭左邊是否為合法表達式
    this.Expression();
    this.buildCode(`;${indexIdentifier.accessName}<=`);

    // 檢查箭頭有沒有好好寫
    if (this.nowTokenIs(Tokens.Arrow)) {
      this.movePointerToNext();
    } else {
      this.reportError(Errors.MissingArrow, this.nowToken);
      this.recover(Tokens.LoopHead);
      return;
    }

    // 檢查箭頭右邊是否為合法表達式
    this.Expression();
    this.buildCode(`;++${indexIdentifier.accessName})`);

    // 此時才宣告變數，避免有人在箭頭兩邊的敘述就使用遍歷迴圈的變數但檢查不到
    this.declareVariable(indexIdentifier);
  }

  // 印出敘述
  private Print(): void {
    this.buildCode("_write(");

    // 必須接字串或表達式
    if (this.nowTokenIs(Tokens.String))
      this.String();
    else
      this.Expression();

    this.buildCode(`)`);
  }

  // 檢查是否為表達式
  private Expression(): void {
    this.buildCode(this.expressionParser.parse());
  }

  // 檢查識別字
  private Identifier(checkExist = true, build = true, idToken = this.nowToken): void {
    // 如果不是識別字就是有問題
    if (idToken?.token !== Tokens.Identifier) {
      this.reportError(Errors.MissingIdentifier, this.nowToken);
      return;
    }

    // 需要檢查才抓取識別字物件
    const identifier = checkExist
      ? this.getResolvedIdentifier(idToken.value)
      : undefined;

    // 抓取不到代表沒有宣告
    if (checkExist && !identifier) {
      this.reportError(Errors.IdentifierNotDefined, this.nowToken);
      return;
    }

    if (build) {
      const name = identifier?.accessName ?? new Identifier(idToken, this.nowLevel).accessName
      this.buildCode(name)
    }

    this.movePointerToNext()
  }

  // 檢查字串
  private String(): void {
    // 是字串就建碼
    if (this.nowTokenIs(Tokens.String)) {
      this.buildCode(this.nowToken!.value);
      this.movePointerToNext();
      return;
    }
    // 否則丟出遺漏字串錯誤
    this.reportError(Errors.MissingString, this.nowToken);
    this.recover(Tokens.Statement);
  }

  // 宣告函式
  private FunctionDeclaration(): void {
    const functionToken = this.nowToken!;
    this.movePointerToNext();
    // 這裡已經確定是 := 了，所以繼續往下走
    this.movePointerToNext();

    if (!this.nowTokenIs(Tokens.LeftBracket)) {
      this.reportError(Errors.MissingLeftBracket, this.nowToken);
      this.recover(Tokens.FunctionDeclaration);
      return;
    }

    this.movePointerToNext();

    const declarationLevel = this.nowLevel;
    const parameterLevel = declarationLevel + 1;
    const parameters: Identifier[] = [];
    const parameterNames = new Set<string>();

    // 先讀取參數並存起來不宣告，因為要知道函式的 arity 後才能註冊
    while (this.nowToken && !this.nowTokenIs(Tokens.RightBracket)) {
      // 是否為傳參考語法
      const byReference = this.nowTokenIs(Tokens.Multiply);
      if (byReference) {
        this.movePointerToNext();
      }

      // 函式參數只能是識別字
      if (!this.nowTokenIs(Tokens.Identifier)) {
        this.reportError(Errors.InvalidFunctionParameter, this.nowToken);
        this.recover(Tokens.FunctionDeclarationParameter);
        break;
      }

      const parameterToken = this.nowToken!;

      // 如果已經出現在參數列表
      if (parameterNames.has(parameterToken.value)) {
        this.reportError(Errors.RedeclareParameter, parameterToken);
        this.recover(Tokens.FunctionDeclarationParameter);
        break;
      }

      // 加入參數列表並製作識別字物件
      parameterNames.add(parameterToken.value);
      const parameter = new Identifier(parameterToken, parameterLevel, byReference);
      parameters.push(parameter);
      this.movePointerToNext()

      // 如果是逗號就繼續往下
      if (this.nowTokenIs(Tokens.Comma)) {
        this.movePointerToNext();
        continue;
      }

      break;
    }

    // 參數列以右括號結尾
    if (!this.nowTokenIs(Tokens.RightBracket)) {
      this.reportError(Errors.MissingRightBracket, this.nowToken);
      this.recover(Tokens.FunctionDeclarationParameter);
    }

    this.movePointerToNext()

    // 宣告函式
    const declaration = new FunctionDeclaration(functionToken, declarationLevel, parameters);
    if (!this.functionTable.declare(declaration)) {
      this.reportError(Errors.RedeclareFunction, functionToken);
      this.recover(Tokens.FunctionDeclaration);
      return;
    }

    // 進入區塊
    this.nowLevel = parameterLevel; // parameterLevel = nowLevel + 1
    const previousFunctionState = this.insideFunction;
    const previousLoopState = this.insideLoop;

    try {
      this.insideFunction = true;
      this.insideLoop = false;

      // 登記識別字
      for (const parameter of parameters) {
        // 理論上這段不會出現，因為前面已經檢查過參數沒有重複
        // 而這個區塊除了這幾個參數沒有其他識別字
        // 但仍然例行性的檢查
        if (!this.idTable.declare(parameter)) {
          this.reportError(Errors.RedeclareIdentifier, parameter.token);
        }
      }

      this.buildCode(`const ${declaration.generatedName}=function(${parameters.map(parameter => parameter.generatedName).join(',')}){`)

      // 左括號表示進入函式區域
      if (!this.nowTokenIs(Tokens.LeftBracket)) {
        this.reportError(Errors.MissingLeftBracket, this.nowToken);
        return;
      }
      this.movePointerToNext()

      // 解析敘述
      while (this.isStartOfStatement()) {
        this.Statement();
      }

      // 結束函式區域
      if (!this.nowTokenIs(Tokens.RightBracket)) {
        this.reportError(Errors.MissingRightBracket, this.nowToken)
        this.recover(Tokens.FunctionDeclaration)
        return;
      }

      this.movePointerToNext();
      this.buildCode('};');

    } finally {
      this.insideFunction = previousFunctionState;
      this.insideLoop = previousLoopState;
      this.leaveBlock();
    }
  }

  private ReturnStatement(): void {
    if (!this.insideFunction) {
      this.reportError(Errors.ReturnOutsideFunction, this.nowToken);
      this.recover(Tokens.ReturnStatement);
      return;
    }
    this.movePointerToNext();
    this.buildCode("return ");

    if (this.nowTokenIs(Tokens.String)) {
      this.String()
    } else {
      this.Expression();
    }

    this.buildCode(";")
  }

}

export { Parser }
