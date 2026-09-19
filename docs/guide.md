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
ES Module:
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
    module2: 'code:/** Code of module2 **/'
  }, 
  disabledFunctions: ['eval']
});
```
### 模組
模組是 HiZollo Script 中最重要的東西，他決定了一個 HiZollo Script 可以做多少 JavaScript 的工作。模組可以分為兩種：核心模組與一般模組。

#### 核心模組
任何編譯器必須提供一個 `core` 核心模組。核心模組一定會被建碼，且不能由使用者手動引入。核心模組中一定要實作以下三個函式：
- `_start()`：在程式的最一開始會呼叫此函式
- `_write(content: any)`：在使用者使用 `<<<` 輸出時會呼叫此函式
- `_panic(e: Error)`：程式發生執行錯誤時會呼叫此函式
- `_end()`：在程式結束時會呼叫此函式

除此之外沒有任何限制，可以自行加上任何函式或副作用。

#### 範例核心模組實作
```js
var _buffer = ""; function _start() { } function _write(str) { _buffer += str; if (_buffer.length > 1024) _flush(); } function _panic(e) { throw e; } function _end() { _flush(); } function _flush() { process.stdout.write(_buffer); _buffer = ""; }
```

#### 一般模組
建立一般模組時，只需要建立一個包含 JavaScript 程式碼的檔案，並在建立 Compiler 時，於 includes 中指定模組名稱與檔案路徑即可。只有被引用的模組才會被建碼。

你也可以動態建立模組，此時不需要提供檔案，只需在原本放置檔案路徑的位置使用 `code:你的程式`。編譯器會將其視為 JavaScript 程式碼，並在建碼時直接加入。

模組使用 __hzs_export() 將函式提供給使用者：
```js
__hzs_export("namespace", { func1, func2 });
```
`namespace` 僅用於表示函式的來源，以及在警告和錯誤訊息中使用。使用者呼叫函式時只需要使用函式名稱，不需要指定 `namespace`。例如：
```js
function hello(name) {
    return "Hello, " + name;
}

__hzs_export("greeting", { hello });
```
使用者可以直接呼叫：
```
hello("World")
```
不同 namespace 可以匯出相同的函式名稱。當發生函式名稱衝突時，後匯出的函式會覆蓋先前匯出的函式。這取決於使用者的引入順序。

函式是否提供給使用者使用，由 `__hzs_export()` 決定。未透過 `__hzs_export()` 匯出的函式只能在模組內部使用。此外，使用者可以使用的函式名稱只能由英文字母與數字組成，因此要匯出給使用者的函式，名稱只能由英文字母與數字組成，不能包含特殊字元。

### 禁用函式
在舊版 HiZollo Script 中，使用者仍能存取一些全域的 JavaScript 函式，所以設計可以在 `disabledFunctions` 選項中指定一些函式的名稱，當使用者使用了那些函式時，編繹器會自動丟出編譯錯誤。雖然在 1.2.1 版本後使用者不再能直接呼叫全域函式，這個功能還是保留了下來。你一樣可以在這裡指定一些函式，當使用者使用之後會自動得到編譯失敗。

### 編譯程式
接下來，你就可以使用 [`Compiler#compile`](./docs.md#成員函式) 方法來編譯 HiZollo Script。將完整的 HiZollo Script 原始碼當作參數傳入。
```js
const result = compiler.compile(source);
```
編譯器會回傳一個 [`CompileResult`](./docs.md#compileresult) 物件，其中 `build` 物件中會含有建碼。確定沒有編譯錯誤後，你可以使用 `eval`、其他東西或下方的 `ExecutionWorker` 來幫你執行此程式。

## 使用 ExecutionWorker
[ExecutionWorker](./docs.md#executionworker) 是此套件提供用來執行編譯後內容的物件。你可以設定一個執行時間上限，時間到後若沒有結束，他會自動拋出 `RUNTIME_EXCEED_LIMIT` 例外。

### 引入敘述
CommonJS:
```js
const { ExecutionWorker } = require('@hizollo/hzscript');
```
ES Module:
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

