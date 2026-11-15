# 模組
在 HiZollo Script 中，模組是使用 JavaScript 撰寫，且可以分為兩種：核心模組與一般模組。核心模組的功能是提供固定函式銜接 HiZollo Script 的建碼結果與執行環境，一般模組則是負責暴露 JavaScript 的能力給 HiZollo Script 使用。

## 核心模組
任何編譯器必須提供一個 `core` 核心模組。核心模組一定會被建碼，且不能由使用者手動引入。核心模組中一定要實作以下四個函式：
- `_start()`：在程式的最一開始會呼叫此函式
- `_write(content: any)`：在使用者使用 `<<<` 輸出時會呼叫此函式
- `_panic(e: Error)`：程式發生執行錯誤時會呼叫此函式
- `_end()`：在程式結束時會呼叫此函式

除此之外沒有任何限制，可以自行加上任何函式或副作用。

### 範例核心模組實作
```js
var _buffer = ""; function _start() { } function _write(str) { _buffer += String(str); if (_buffer.length > 1024) _flush(); } function _panic(e) { throw e; } function _end() { _flush(); } function _flush() { process.stdout.write(_buffer); _buffer = ""; }
```

## 一般模組
在一般模組，你可以使用 __hzs_export() 將函式提供給使用者：
```js
__hzs_export("namespace", { func1, func2 });
```
`namespace` 僅用於表示函式的來源，以及在警告和錯誤訊息中使用。使用者呼叫函式時只需要使用函式名稱，不需要指定 `namespace`。例如：
```js
function add(a, b) {
    return a + b
}

__hzs_export("math", { add });
```
使用者可以直接呼叫：
```
add(1, 2)
```
這會被轉譯成
```js
__hzs_invoke("add", 1, 2)
```
不同 namespace 可以匯出相同的函式名稱。當發生函式名稱衝突時，後匯出的函式會覆蓋先前匯出的函式。這取決於使用者的引入順序。

函式是否提供給使用者使用，由 `__hzs_export()` 決定。未透過 `__hzs_export()` 匯出的函式只能在模組內部使用。此外，使用者可以使用的函式名稱只能由英文字母與數字組成，因此要匯出給使用者的函式，名稱只能由英文字母與數字組成，不能包含其他特殊字元。

### 載入模組
提供一般模組給編譯器，可以透過建立一個包含 JavaScript 程式碼的檔案，並在建立 Compiler 時於 `includes` 中指定模組名稱與檔案路徑：
```js
const compiler = new Compiler({
  includes: {
    core: "./modules/core.js",
    Math: "./modules/math.js",
    Utils: "./modules/utils.js"
  }
});
```
也可以動態建立模組，不需要建立檔案，只需在原本放置檔案路徑的位置使用 `code:你的程式`：
```js
const compiler = new Compiler({
  includes: {
    core: "./modules/core.js",
    Extra: `code:function answer() { return 42; } __hzs_export("Extra", { answer });`
  }
});
```
只有被使用者引入，或是被其他模組依賴的模組才會被建碼。依賴模組會先於依賴它的模組建碼，且相同模組不會重複載入。

### 前言指令

在一般模組中，最前方由 `//` 開頭的行被稱為前言。例如：
```js
// 這裡是第一行
// 這些地方都會被解析器當成前言

// 這裡也是
function empty() {}

// 這裡不是前言
```
前言中可以撰寫指令，向模組解析器表示額外資訊。目前支援以下指令：

### `#noimport`
```js
// #noimport
```
使用此指令後，這個模組將無法被使用者手動引入。但是其他模組仍然可以透過 `#require` 依賴這個模組。

### `#require "name"`

```js
// #require "Math"
```

告訴解析器這個模組依賴 `Math` 模組，解析器會先載入 `Math`，再載入目前模組。

可以宣告多個依賴：
```js
// #require "Math"
// #require "Database"
```
如果多個模組依賴相同的模組，或是使用者已經直接引入該模組，解析器會避免重複載入。`#require` 也會遞迴解析依賴，因此被依賴的模組本身也可以使用 `#require`。

---

## Runtime API
編譯器在產生執行程式碼時，會在模組程式碼之前加入 Runtime Bootstrap。
Runtime Bootstrap 負責初始化執行環境，並提供模組匯出、函式呼叫、錯誤處理、警告管理及共享資料儲存等功能。

### Runtime 初始化與執行順序
Runtime 的初始化與執行順序如下：
1. 初始化 `globalThis.__hzs__` 及相關 Runtime 狀態。
2. 定義 Runtime 提供的類別與函式。
3. 載入核心模組。
4. 依照依賴關係載入一般模組。
5. 呼叫 `_start()`。
6. 執行使用者撰寫的 HiZollo Script。
    - 發生錯誤時呼叫 `_panic()`。
7. 程式結束時呼叫 `_end()`。

一般模組的程式碼會在 Runtime 初始化完成後執行，因此可以直接使用 Runtime 提供的類別與函式。

### `__hzs_export(namespace, obj)`
將 `obj` 裡的函式以該命名空間匯出。這個命名空間目前只做記錄用，執行時沒有意義。

### `__hzs_invoke(name, ...args)`
專門用來呼叫模組函式的函式。使用者在 HiZollo Script 中撰寫的模組函式呼叫都會被編譯成 `__hzs_invoke` 的形式，所以如果模組要呼叫其他模組函式，可以也推薦使用這個方法。

### `__hzs_has_module(name)`
檢查指定名稱的模組是否存在於目前的編譯結果。
```js
if (__hzs_has_module("Math")) {
    // Math module is included
}
```
回傳值：
- `true`：指定模組已被納入目前的編譯結果。
- `false`：指定模組未被納入目前的編譯結果。

使用者直接引入的模組以及透過 `#require` 間接引入的模組都會被視為已納入。核心模組 `core` 則是永遠回傳 `true`。

此函式僅檢查模組是否會被包含在編譯結果，如果模組完全依賴另一個模組提供的函式，仍建議使用 `#require` 前言指令以確保正確的載入順序。

### `HZSRuntimeError`
`HZSRuntimeError` 是 Runtime 提供的錯誤類別，繼承 JavaScript 原生的 `Error`。
建構方式：
```js
new HZSRuntimeError(code, data);
```
參數：
- `code`：字串，表示錯誤代碼。
- `data`：物件，提供額外錯誤資訊，可省略，預設為 `{}`。

物件包含以下屬性：
- `name`：固定為 `"HZSRuntimeError"`
- `code`：錯誤代碼
- `data`：額外錯誤資訊

例如：
```js
throw new HZSRuntimeError("MY_MODULE_ERROR", { reason: "Something went wrong" });
```

Runtime 本身目前使用以下錯誤代碼：
| Code | Data | 說明 |
|---|---|---|
| `MODULE_FUNCTION_DISABLED` | `{ name }` | 使用了被禁用的模組函式 |
| `MODULE_FUNCTION_NOT_FOUND` | `{ fn }` | 找不到指定的模組函式 |
| `NOT_A_MODULE_FUNCTION` | `{ name }` | 指定的名稱不是函式 |

模組也可以使用自己的錯誤代碼，並透過 `data` 傳遞額外資訊，讓 `_panic` 能給出好的錯誤訊息。

### `HZSWarning`
`HZSWarning` 是 Runtime 提供的警告類別。建構方式：
```js
new HZSWarning(code, data);
```
參數：
- `code`：字串，表示警告代碼。
- `data`：物件，提供額外警告資訊，可省略，預設為 `{}`。

物件包含以下屬性：
- `name`：固定為 `"HZSWarning"`
- `code`：警告代碼
- `data`：額外警告資訊

`HZSWarning` 不像 `HZSRuntimeError` 一樣繼承 `Error`，也不會透過拋出例外的方式處理。

目前 Runtime 使用以下警告：

#### `FUNCTION_COLLISION`

當不同模組匯出相同名稱的函式時，Runtime 會建立此警告：

```js
new HZSWarning("FUNCTION_COLLISION", {
  fn: "add",
  oldNs: "Math",
  newNs: "Extra"
});
```
其中 `fn` 是發生衝突的函式名稱、`oldNs`是原本提供函式的 namespace、`newNs`是後來提供函式的 namespace。

### `globalThis.__hzs__.__data__`
Runtime 提供 `__data__` 作為一般模組共享的資料儲存空間。
```js
globalThis.__hzs__.__data__
```

它是一個空的物件，並且使用 `Object.create(null)` 建立。

所有一般模組都可以存取這個物件，因此可以利用它在不同模組之間共享資料。

建議每個模組使用自己的 namespace 存放資料，避免與其他模組發生名稱衝突。

### `globalThis.__hzs__.__warnings__`
Runtime 使用 `__warnings__` 儲存執行期間產生的警告。
```js
globalThis.__hzs__.__warnings__
```
這是一個陣列，內容為 `HZSWarning` 物件。

### 其他 Runtime 內部狀態

`globalThis.__hzs__` 除了提供共享資料與警告儲存空間，也包含其他供 Runtime 內部使用的狀態。

| 屬性 | 用途 |
|---|---|
| `__module__` | 記錄目前編譯結果包含的模組 |
| `__disabledModuleFunctions__` | 記錄被禁用的模組函式 |
| `__fn__` | 依照 namespace 分組的函式註冊表 |
| `__callable__` | 提供函式名稱與函式實作之間的對應 |

這些屬性由 Runtime 管理，模組可以讀取但不應該修改，以免影響函式呼叫、模組資訊及執行環境的正常運作。
