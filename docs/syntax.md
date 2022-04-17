# HiZollo Script 語法說明

## 變數宣告
```
<Identifier> := <Number>
```
[範例](../examples/declaration.hzs)

在宣告運算子 `:=` 左邊放上欲宣告的變數名稱，右邊放上數字，即可宣告變數。變數名稱只能使用大小寫英文字母，且同一區塊相同變數名稱只能宣告一次。

## 指定運算
```
<Identifier> = <Expression>
```
[範例](../examples/assignment.hzs)

在指定運算子 `=` 左邊放上變數名聲，右邊放上運算式，即可指定變數為特定值。運算式可以是四則運算或函式呼叫。

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

## 計數迴圈
```
[<Identifier> = <Expression> -> <Expression>] (
  <Statement>
)
```

## 引入模組
```
>>> <String>
```

## 函式呼叫
```
<Identifier>(<ParameterList>)

<ParameterList> ::= <Parameter>, { <Parameter> }
<Parameter> ::= <Expression> | <String>
```
