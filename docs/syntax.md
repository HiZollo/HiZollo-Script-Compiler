# HiZollo Script 語法說明

## 變數宣告
```
<Identifier> := <Number>
```
[範例](../examples/declaration.hzs)

在宣告運算子 `:=` 左邊放上欲宣告的變數名稱，右邊放上數字，即可宣告變數。變數名稱只能使用大小寫英文字母和數字（不能用數字開頭），且同一區塊相同變數名稱只能宣告一次。

## 指定運算
```
<Identifier> = <Expression>
```
[範例](../examples/assignment.hzs)

在指定運算子 `=` 左邊放上變數名稱，右邊放上運算式，即可指定變數為特定值。運算式可以是四則運算或[函式呼叫](函式呼叫)。

## 交換運算
```
<Identifier> <-> <Identifier>
```
[範例](../examples/swap.hzs)

在交換運算子 `<->` 左右放上欲交換內容的變數名稱，就可以交換兩者的內容。請注意兩個變數必須已經宣告過並且還存活在此區塊，不然會出現識別字未宣告的錯誤。

## 輸出敘述
```
<<< <String> | <Expression>
```
[範例](../examples/write.hzs)

在輸出運算子 `<<<` 右邊放上欲輸出的東西。可以輸出字串或運算式（包含函式呼叫）。

## 流程控制
### If
```
{ <Condition> } (
  <Statement>
)

<Condition> ::= <Expression> >|>=|==|<=|<|!= <Expression>
```
[範例](../examples/if.hzs)

在大括號中放入一個比較的算式，接續一個小括號，裡面放上要執行的內容。當條件式執行結果是正確的時候，就會執行小括號裡面的內容，否則會跳過。

條件式是兩個表達式，中間使用關係運算子（`>`、`>=`、`==`、`<=`、`<`、`!=`）連接。

### If-Else
```
{ <Condition> } (
  <Statement>
) / (
  <Statement>
)
```
[範例](../examples/if-else.hzs)
在 If 後面加上一個斜線後，接續一個小括號，並在那個小括號裡面放上要執行的內容。

當條件式的結果是正確時，會執行第一個小括號中的內容，第二個則跳過，否則只執行第二個小括號中的內容

### If-ElseIf-Else
```
{ <Condition> } (
  <Statement>
) / { <Condition> } (
  <Statement>
) / (
  <Statement>
)
```
[範例](../examples/if-elseif-else.hzs)

如果在斜線和小括號之間加上一組大括號和條件式，就會將它變成 Else If。在 If 和 Else 之間可以插入任意個 Else If 語句。程式會由上到下判斷條件，並在遇到正確的條件時執行該區塊，否則執行 Else 區塊。

整個 If-ElseIf-Else 敘述中只會有至多一個區塊被執行

## 計數迴圈
```
[<Identifier> = <Expression> -> <Expression>] (
  <Statement>
)
```
[範例](../examples/for.hzs)

在一對中括號內放入一個識別字 `=` 算式 `->` 算式，後方接上一個小括號，即完成一計數迴圈。小括號內可以放入任意敘述。

計數回圈會將放在中括號內的識別字宣告成一迴圈範圍的變數，讓他從箭頭左邊的表達式的值開始，執行小括號的內容，之後加一，重複以上過程直到他的值超過箭頭右邊的值。

請注意你必須保證箭頭左邊小於右邊，否則迴圈將不會被執行。

## 引入模組
```
>>> <String>
```
[範例](../examples/import.hzs)

使用引入符號 `>>>` 加上 `"套件名稱"` 可以引入套件供程式使用。有什麼套件是由提供編譯器的人決定，HiZollo 官方有自己的一套套件，但任何人都可以製作套件給 HiZollo Script 的編譯器使用。

你不可以飲入相同套件兩次，且引入敘述只能放在程式開頭。


## 函式呼叫
```
<Identifier>(<ParameterList>)

<ParameterList> ::= <Parameter> {, <Parameter> }
<Parameter> ::= <Expression> | <String>
```
[範例](../examples/function.hzs)

HiZollo Script 不能讓使用者自訂函式，所有函式都是從外部來的。你可以使用 `函數名稱(參數一, 參數二, ...)` 來呼叫函式。

一個函式如何呼叫取決於該套件的定義，請參見個別套件之定義。
