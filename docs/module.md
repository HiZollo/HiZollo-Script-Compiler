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

提供一般模組給編譯器，可以透過建立一個包含 JavaScript 程式碼的檔案，並在建立 Compiler 時，於 includes 中指定模組名稱與檔案路徑即可。只有被引用的模組才會被建碼。

你也可以動態建立模組，此時不需要建立檔案，只需在原本放置檔案路徑的位置使用 `code:你的程式`。編譯器會將其視為 JavaScript 程式碼，並在建碼時直接加入。

### 前言指令
在一般模組中，最前方由 `//` 開頭的行被稱為前言。例如：
```
// 這裡是第一行
// 這些地方都會被解析器當成前言
// 這裡也是
function empty() {}
// 這裡不是前言
```
你可以在前言中撰寫一些指令，藉此向模組解析器表示一些額外資訊。目前可以使用的前言指令有以下
- `#noimport`：使用此指令後，這個模組會無法被使用者手動引入
- `#require "name"`：告訴解析器這個模組依賴 `name` 模組，解析器會先載入 `name`。如果有多個模組依賴相同的模組，或是使用者引入了被依賴的模組，解析器會忽略後面的，所以一個模組只會被載入一次。
