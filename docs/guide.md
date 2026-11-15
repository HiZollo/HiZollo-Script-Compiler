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
在 HiZollo Script 中，模組是使用 JavaScript 撰寫，負責暴露 JavaScript 的能力給 HiZollo Script。
有關模組的解說，請參考[模組](./module.md)。

### 禁用函式
在舊版 HiZollo Script 中，使用者仍能存取一些全域的 JavaScript 函式，所以設計可以在 `disabledFunctions` 選項中指定一些函式的名稱，當使用者使用了那些函式時，編譯器會自動丟出編譯錯誤。雖然在 1.2.1 版本後使用者不再能直接呼叫全域函式，這個功能還是保留了下來。你一樣可以在這裡指定一些函式，當使用者使用之後會自動得到編譯失敗。

### 編譯程式
接下來，你就可以使用 [`Compiler#compile`](./docs.md#成員函式) 方法來編譯 HiZollo Script。將完整的 HiZollo Script 原始碼當作參數傳入。
```js
const result = compiler.compile(source);
```
編譯器會回傳一個 [`CompileResult`](./docs.md#compileresult) 物件，其中 `build` 物件中會含有建碼。確定沒有編譯錯誤後，你可以使用 `eval`、其他東西或下方的 `ExecutionWorker` 來幫你執行此程式。

## 使用 ExecutionWorker
[ExecutionWorker](./docs.md#executionworker) 是此套件提供用來執行編譯後內容的物件。你可以設定一個執行時間上限，時間到後若沒有結束，他會自動拋出 `EXCEED_RUNTIME_LIMIT` 例外。

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

