import { Compiler } from './dist/index.mjs'

const compiler = new Compiler({
  includes: {
    core: 'code:function _start(){}function _end(){}function _panic(){}function _write(s){console.log(s)}'
  }
})

const result = compiler.compile(`
$increment := (*x) ( x = x + 1 )
$increment2 := (*x) ( $increment(x) )
a := 1
$increment2(a)
<<< a
`)

console.log(result.errorMessages.textify)
console.log(result)
eval(result.build.full)
