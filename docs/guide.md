# 使用教學
## 下載此套件
```
npm i --save @hizollo/hzscript
yarn add @hizollo/hzscript
```
取決於你使用 `npm` 或 `yarn`，請在終端機輸入指令下載。如果你是使用其他套件管理器，請參考他們的下載方式。

## 使用編譯器

### 引入敘述
CommonJS:
```js
const { Compiler } = require('@hizollo/hzscript');
```
ModuleJS:
```js
import { Compiler } from '@hizollo/hzscript';
```

### 建立實例
匯入 [Compiler](./docs.md#compiler) 後，建立一個自己的 [Compiler](./docs.md#compiler) 實例：
```js
const compiler = new Compiler({
  includes: {
    core: 'path/to/core/module.js',
    module1: 'path/to/the/module.js',
    module2: 'path/to/this/module.js'
  }
});
```
### 模組
模組是 HiZollo Script 中最重要的東西，他決定了一個 HiZollo Script 可以做多少 JavaScript 的工作。

要建立一個模組，只需要建立一個包含數個函數的 JavaScript 檔案就好。然後在建立 Compiler 的選項中，`includes` 裡輸入模組的名稱以及檔案路徑。模組檔案本身並不需用 export 任何東西，編譯器會自動複製模組檔案的全部內容，貼入建碼之中。

任何編譯器一定要提供一個 `core` 核心模組。核心模組一定會被建碼，且不能由使用者手動引入（其他模組都是使用者有引入才會建碼）。核心模組中一定要實作以下三個函式：
- `_start()`：在程式的最一開始會呼叫此函式
- `_write(content: any)`：在使用者使用 `<<<` 輸出時會呼叫此函式
- `_end()`：在程式結束時會呼叫此函式

除此之外，想提供什麼以及不想提供什麼都由你決定。

請注意使用者只能使用名稱只有英文字母跟數字的函數，因此如果你不想讓使用者碰到一些內部的函式，可以使用特殊字元在函式身上；相反的，如果你想讓使用者使用一個函式，請不要用特殊字元進行命名。

此外，我們建議最小化你的模組，建出來的程式碼會比較好看。

#### 範例核心模組實作
```js
var _buffer = ""; function _start() { } function _write(str) { _buffer += str; if (_buffer.length > 1024) _ flush(); } function _end() { _flush(); } function _flush() { process.stdout.write(_buffer); _buffer = ""; }
```

### 編譯程式
接下來，你就可以使用 [`Compiler#compile`](./docs.md#成員函式) 方法來編譯 HiZollo Script。將完整的 HiZollo Script 原始碼當作參數傳入。
```js
const result = compiler.compile(source);
```
編譯器會回給你一個 [`CompileResult`](./docs.md#compileresult) 物件，其中 `build` 會有建碼。確定沒有編譯錯誤後，你可以使用 `eval`、其他東西或下方的 `ExecutionWorker` 來幫你執行此程式。

## 使用 ExecutionWorker
[ExecutionWorker](./docs.md#executionworker) 是此套件提供用來執行編譯後內容的物件。你可以設定一個執行時間上限，時間到後若沒有結束，他會自動拋出 `RUNTIME_EXCEED_LIMIT` 例外。

### 引入敘述
CommonJS:
```js
const { ExecutionWorker } = require('@hizollo/hzscript');
```
ModuleJS:
```js
import { ExecutionWorker } from '@hizollo/hzscript';
```

### 建立實例

```js
const ew = new ExecutionWorker(code);
```
code 部分放入純 JavaScript 程式

### 執行程式
```js
ew.execute({ maxExecutionTime: 3000 });
```
執行輸入的程式，如果執行時間超過 3 秒將會自動結束。此動作回傳 Promise，如果你想等待執行結束再繼續往下，可以使用 `await`。

## 文件
請參閱[文件](./docs.md)。
