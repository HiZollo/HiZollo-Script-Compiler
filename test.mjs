import { Compiler } from './dist/index.mjs'

const compiler = new Compiler({
  includes: {
    core: 'code:function _start() {} function _end() {} function _panic(e) { throw e } function _write(s) { process.stdout.write(String(s)) }'
  }
})

const result = compiler.compile(`
a := 123
b := 456
<<< a + b
`)

console.log(result)
eval(result.build.full)
