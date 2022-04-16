import { Token, Tokens } from '../constant/token';

type textIdType = string | -1;

class Scanner {
  private source: string[];
  private nextWord: textIdType;
  private linePosition: number;
  private charPosition: number;
  private currentLine: string;
  
  constructor() {
    this.source = [];
    this.nextWord = '';
    this.linePosition = 0;
    this.charPosition = 0;
    this.currentLine = '';
  }

  public read(text: string): void {
    this.source = [...this.source, ...text.split(/\r?\n/g)];
  }

  // 將指標移至下一個字元的函式
  private advance(): void {
    // 往前移動一格
    this.charPosition++;

    // 如果還沒到行尾，回傳當下字元
    if (this.charPosition < this.currentLine.length) {
      this.nextWord = this.currentLine[this.charPosition];
      return;
    }

    // 如果已經到了檔案結尾，結束
    if (this.linePosition === this.source.length) {
      this.currentLine = '';
      this.nextWord = -1;
      return;
    }

    // 走到這代表 1. 已經到該行結尾 2. 這行不是最後一行
    // 將指標移動至下一行，如果下一行是空行那就繼續往下，直到碰到有東西
    do {
      this.currentLine = this.source[this.linePosition++];
      // 碰到 undefined 就代表走到底了，結束
      if (this.currentLine === undefined) {
        this.charPosition = 0;
        this.currentLine = '';
        this.nextWord = -1;
        return;
      }
    } while(!this.currentLine.length);

    // 重設指標位置至行首並讀取
    this.charPosition = 0;
    this.nextWord = this.currentLine[this.charPosition];
  }

  // 解析下一個 token 的函式
  public nextToken(): Token | null {
    // 如果下個字是 -1，代表已到檔案結尾
    if(this.nextWord === -1) return null;

    // 這個 token 的值
    let tokenValue: string = '';
    while(true) {
      // 檢查是否為 Identifier
      if (/[A-Za-z]/.test(this.nextWord)) {
        // 繼續往下讀取直到碰到非識別字可用字符
        do {
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === -1) break;
        } while(/[A-Za-z0-9]/.test(this.nextWord))

        // 回傳
        return this.makeToken(Tokens.Identifier, tokenValue);
      }
      // 檢查是否為數字
      if (/\d+/.test(this.nextWord)) {
        // 繼續往下讀取直到碰到非數字
        do {
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === -1) break;
        } while(/\d+/.test(this.nextWord));

        // 回傳
        return this.makeToken(Tokens.Number, tokenValue)
      }

      // 檢查
      switch(this.nextWord) {
        // : 開頭
        // 可能識別符：「:」Colon、「:=」Declare
        case ':':
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === '=') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.Declare, tokenValue);
          }
          return this.makeToken(Tokens.Colon, tokenValue);

        // = 開頭
        // 可能識別符：「=」Assign、「==」Equal
        case '=':
          tokenValue += this.nextWord;
          this.advance();
          if (this.nextWord === '=') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.Equal, tokenValue);
          }
          return this.makeToken(Tokens.Assign, tokenValue);

        // ! 開頭
        // 可能識別符：「!=」Inequal
        case '!':
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === '=') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.Inequal, tokenValue);
          }

          return this.makeToken(Tokens.ERROR, tokenValue);

        // < 開頭
        // 可能識別符：「<」LessThan、「<=」LessOrEqual、「<<<」Write
        case '<':
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === '=') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.LessOrEqual, tokenValue);
          }

          if (this.nextWord === '<') {
            tokenValue += this.nextWord;
            this.advance();
            if (this.nextWord === '<') {
              tokenValue += this.nextWord;
              this.advance();
              return this.makeToken(Tokens.Write, tokenValue);
            }
            return this.makeToken(Tokens.ERROR, tokenValue);
          }

          return this.makeToken(Tokens.LessThan, tokenValue);

        // > 開頭
        // 可能識別符：「>」GreaterThan、「>=」GreaterOrEqual、「>>>」Import
        case '>':
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === '=') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.GreaterOrEqual, tokenValue);
          }
          if (this.nextWord === '>') {
            tokenValue += this.nextWord;
            this.advance();
            if (this.nextWord === '>') {
              tokenValue += this.nextWord;
              this.advance();
              return this.makeToken(Tokens.Import, tokenValue);
            }
            return this.makeToken(Tokens.ERROR, tokenValue);
          }
          return this.makeToken(Tokens.GreaterThan, tokenValue);

        // " 開頭，為字串字面常數
        // 從雙引號開始，一路往下讀，不可換行，直到下一個雙引號
        case '"':
          let nowLine = this.linePosition;
          tokenValue += this.nextWord;
          this.advance();
          while (this.nextWord !== '"' && nowLine === this.linePosition) {
            tokenValue += this.nextWord;
            this.advance();
          }
          if (nowLine === this.linePosition) {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.String, tokenValue);
          }
          return this.makeToken(Tokens.ERROR, tokenValue);

        // + 開頭
        // 可能識別符：「+」Plus
        case '+':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.Plus, tokenValue);

        // - 開頭
        // 可能識別符：「-」Minus、「->」Arrow
        case '-':
          tokenValue += this.nextWord;
          this.advance();
          // @ts-ignore
          if (this.nextWord === '>') {
            tokenValue += this.nextWord;
            this.advance();
            return this.makeToken(Tokens.Arrow, tokenValue);
          }
          return this.makeToken(Tokens.Minus, tokenValue);

        // * 開頭
        // 可能識別符：「*」Multiply
        case '*':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.Multiply, tokenValue);

        // / 開頭
        // 可能識別符：「/」Divide
        case '/':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.Divide, tokenValue);

        // { 開頭
        // 可能識別符：「{」LeftCurlyBracket
        case '{':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.LeftCurlyBracket, tokenValue);

        // } 開頭
        // 可能識別符：「}」RightCurlyBracket
        case '}':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.RightCurlyBracket, tokenValue);

        // [ 開頭
        // 可能識別符：「[」LeftSquareBracket
        case '[':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.LeftSquareBracket, tokenValue);

        // ] 開頭
        // 可能識別符：「]」RightSquareBracket
        case ']':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.RightSquareBracket, tokenValue);

        // ( 開頭
        // 可能識別符：「(」LeftBracket
        case '(':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.LeftBracket, tokenValue);

        // ) 開頭
        // 可能識別符：「)」RightBracket
        case ')':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.RightBracket, tokenValue);

        // ? 開頭
        // 可能識別符：「?」Question
        case '?':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.Question, tokenValue);

        // , 開頭
        // 可能識別符：「,」Comma
        case ',':
          tokenValue += this.nextWord;
          this.advance();
          return this.makeToken(Tokens.Comma, tokenValue);

        // 被略過的字元
        case ' ': case '\0': case '\t':
        case '\r': case '\n': case '':
          this.advance(); break;

        // 其他
        default:
          tokenValue = this.nextWord;
          this.advance();
          return this.makeToken(Tokens.ERROR, tokenValue);
      }

    }
  }

  private makeToken(token: Tokens, text: string): Token {
    return new Token(this, {
      token: token,
      left: this.linePosition,
      right: this.charPosition,
      value: text
    });
  }

  public getSource(): string[] {
    return [...this.source];
  }
}

export { Scanner }
