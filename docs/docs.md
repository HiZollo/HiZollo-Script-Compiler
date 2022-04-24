# 文件
## 目錄
- [Complier](#Compiler)
- [ExecutionWorker](#ExecutionWorker)
- [Errors](#Errors)
- [Tokens](#Tokens)
- [類別定義](#類別定義)

## Compiler
### 說明
最主要的類別，會呼叫 `Scanner` 和 `Parser` 來對輸入的 HiZollo Script 程式進行解析和建碼。

### 建構子
```ts
const compiler = new Compiler(options: CompilerOptions)
```
- `options`: 一個 [`CompilerOptions`](#compileroptions) 物件

### 成員函式
- `compile(source: string)`：編譯給定的 HiZollo Script 程式碼。回傳一個 [`CompileResult`](#compileresult) 物件。

## ExecutionWorker
### 說明
一個將 [`Worker`](https://nodejs.org/api/worker_threads.html#class-worker) 包裝起來的類別，可以設定程式執行時間上限，輔助安全執行編譯後的 HiZollo Script。

### 建構子
```ts
const ew = new ExecutionWorker(code: string)
```
- `code`: 要執行的程式。

### 成員函式
- `execute(options: `[`ExecuteOptions`](#executeoptions)`)`：執行程式。回傳一個 `Promise<void>` 表示成功結束。

## Errors
一個表示錯誤內容的列舉，內容與對應中文敘述如下：
- `UnknownStatement`：未知敘述
- `CantImportCoreModule`："不能手動引入核心模組
- `AlreadyImported`：已經引入此模組
- `LateImport`：匯入敘述應該放在程式開頭
- `MissingModuleName`：遺漏模組名稱
- `ModuleNotFound`：找不到模組
- `MissingNumber`：遺漏數字
- `MissingString`：遺漏字串
- `MissingIdentifier`：遺漏識別字
- `IdentifierNotDefined`：變數未宣告
- `RedeclareIdentifier`：變數重複宣告
- `MissingLeftBracket`：遺漏左括號
- `MissingRightBracket`：遺漏右括號
- `MissingRightSquareBracket`：遺漏右中括號
- `MissingRightCurlyBracket`：遺漏右大括號
- `MissingAssignOperator`：遺漏指定運算符
- `MissingDeclareOrAssignOperator`：遺漏指定運算符或宣告運算符
- `MissingArrow`：遺漏箭頭
- `InvalidComparation`：關係運算子錯誤
- `InappropriateBreakStatement`：跳出敘述只能出現在迴圈內

## Tokens
一個表示所有 Token 種類的列舉，請參考[原始碼](../src/constant/token.ts)。

## 類別定義

### CompilerOptions
一個物件，有以下的鍵值對：
- `includes`：[`PathMap`](#pathmap) 物件。

### PathMap
一個鍵值都為字串的物件，其鍵表示套件之名稱，值為套件程式之路徑或程式碼。有關套件知詳細敘述請看[此](./guide.md#模組)。

### CompileResult
一個物件，有以下的鍵值對：
- `errorCount`：編譯錯誤數量。
- `errorMessages`：編譯錯誤訊息，是一個 [`ErrorOutput`](#erroroutput) 物件。
- `build`：建碼。在編譯錯誤數量不為零時不保證建出來的程式碼可運作或運作結果符合預期。

### ErrorOutput
一個物件，有以下的鍵值對：
- `textify`：格式化好的編譯錯誤訊息。
- `errors`：一個 [`CompileError`](#compilererror)`[]` 物件。

### CompileError
一個物件，有以下的鍵值對：
- `error`: [`Errors`](#errors) 列舉的值，對應到此錯誤編號。
- `errorText`: 字串，對應到此錯誤中文敘述。
- `line`: 數字，對應到此錯誤發生之行號。
- `column`: 數字，對應到此錯誤發生之符號最右邊於該行之索引值。
- `token`: [`Tokens`](#tokens) 列舉的值，且應小於 `Tokens.MAX_TERMINAL_TOKEN`，表示發生錯誤之 Token 值。

### ExecuteOptions
一個物件，有以下的鍵值對：
- `maxExecutionTime`：此程式的最大執行時間，以毫秒計，輸入 0 以下的數字來表示無限制。
