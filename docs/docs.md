# 文件
## 目錄
- [Compiler](#Compiler)
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

## ExecutionError
### 說明
[`ExecutionWorker`](#executionworker) 拋出例外時的自訂類別，繼承了 [`Error`](https://nodejs.org/api/errors.html)。

### 屬性
- `message`：錯誤訊息，是一個字串
- `code`：錯誤代號，是一個 [`ExecutionErrorCode`](#executionerrorcode) 列舉

## ExecutionTimeoutError
### 說明
[`ExecutionWorker`](#executionworker) 超時時拋出的自訂例外類別，繼承了 [`ExecutionError`](#executionerror)。

## ExecutionErrorCode
一個表示 [`ExecutionWorker`](#executionworker) 例外狀態的代號列舉，內容如下：
- `WORKER_ERROR`：Worker 運行本身的錯誤
- `EXCEED_RUNTIME_LIMIT`：程式運行超過 ExecutionWorker 設定的時間上限

## Errors
一個表示錯誤內容的列舉，內容與對應中文敘述如下：
- `UnknownStatement`：未知敘述
- `UnknownIdentifier`：未知用途識別字
- `CantImportCoreModule`：不能手動引入核心模組
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
- `MissingArrow`：遺漏箭頭
- `InvalidComparation`：關係運算子錯誤
- `InappropriateBreakStatement`：跳出敘述只能出現在迴圈內
- `UseDisabledFunction`：使用被禁用的函數

## Tokens
一個表示所有 Token 種類的列舉，請參考[原始碼](../src/constant/token.ts)。

## 類別定義

### CompilerOptions
一個物件，有以下的鍵值對：
- `includes`：[`PathMap`](#pathmap) 物件。
- `disabledFunctions`：`string[]`，列出被禁用的函式。

### PathMap
一個鍵值都為字串的物件，其鍵表示套件之名稱，值為套件程式之路徑或程式碼。有關套件知詳細敘述請看[此](./guide.md#模組)。

### CompileResult
一個物件，有以下的鍵值對：
- `errorCount`：編譯錯誤數量。
- `errorMessages`：編譯錯誤訊息，是一個 [`ErrorOutput`](#erroroutput) 物件。
- `build`：建碼，是一個 [`BuildResult`](#buildresult) 物件。

### BuildResult
一個物件，有以下的鍵值對：
- `full`：完整的建碼。在編譯錯誤數量不為 0 時不保證建碼可運作或運作結果符合預期。
- `partial`：除去模組以外的建碼。


### ErrorOutput
一個物件，有以下的鍵值對：
- `textify`：格式化好的編譯錯誤訊息。
- `errors`：一個 [`CompileError`](#compileerror)`[]` 物件。

### CompileError
一個物件，有以下的鍵值對：
- `error`：[`Errors`](#errors) 列舉的值，對應到此錯誤編號。
- `errorText`：字串，對應到此錯誤中文敘述。
- `line`：數字，對應到此錯誤發生之行號。
- `column`：數字，對應到此錯誤發生之符號最右邊於該行之索引值。
- `token`：[`Tokens`](#tokens) 列舉的值，且應小於 `Tokens.MAX_TERMINAL_TOKEN`，表示發生錯誤之 Token 值。

### ExecuteOptions
一個物件，有以下的鍵值對：
- `maxExecutionTime`：此程式的最大執行時間，以毫秒計，輸入 0 以下的數字來表示無限制。
### ExecutionResult
一個物件，有以下的鍵值對：
- `stdout`：[`ExecutionWorker`](#executionworker) 執行後輸出到標準輸出的內容。
- `stderr`：ExecutionWorker 執行後輸出到標準錯誤的內容。
- `exitCode`：ExecutionWorker 執行的程式的結束狀態。
- `executionTime`：ExecutionWorker 執行程式的總運行時間。
