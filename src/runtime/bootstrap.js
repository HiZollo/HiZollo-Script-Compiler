globalThis.__hzs__ = {
  __module__: Object.assign(Object.create(null), __HZS_MODULE_LIST__),
  __disabledFunctions__: Object.assign(Object.create(null), __HZS_DISABLED_FUNCTIONS_LIST__),
  __data__: Object.create(null),
  __fn__: Object.create(null),
  __callable__: Object.create(null),
  __warnings__: []
};

class HZSRuntimeError extends Error {
  constructor(code, data = {}) {
    super(code)
    this.name = "HZSRuntimeError"
    this.code = code
    this.data = data
  }
}

class HZSWarning {
  constructor(code, data = {}) {
    this.name = "HZSWarning"
    this.code = code;
    this.data = data;
  }
}

function __hzs_export(ns, obj_of_func) {
  for (const [funcName, func] of Object.entries(obj_of_func)) {
    if (globalThis.__hzs__.__callable__[funcName]) {
      let oldNs = "unknown";
      for (const [ns, funcs] of Object.entries(globalThis.__hzs__.__fn__)) {
        if (funcs[funcName]) {
          oldNs = ns;
          break;
        }
      }

      globalThis.__hzs__.__warnings__.push(
        new HZSWarning("FUNCTION_COLLISION", { fn: funcName, oldNs, newNs: ns })
      );
    }
    globalThis.__hzs__.__callable__[funcName] = func;
  }

  globalThis.__hzs__.__fn__[ns] = { 
    ...(globalThis.__hzs__.__fn__[ns] || {}), 
    ...obj_of_func 
  };
}

function __hzs_invoke(name, ...args) {
  const func = globalThis.__hzs__.__callable__[name];
  if (!func) {
    throw new HZSRuntimeError("MODULE_FUNCTION_NOT_FOUND", { fn: name });
  }
  if (typeof func !== "function") {
    throw new HZSRuntimeError("NOT_A_MODULE_FUNCTION", { name });
  }
  return func(...args);
}
