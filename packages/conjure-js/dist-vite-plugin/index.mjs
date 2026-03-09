// src/vite-plugin-clj/index.ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync as writeFileSync2, readdirSync, statSync } from "node:fs";
import { resolve, relative, join as join2, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// src/core/types.ts
var valueKeywords = {
  number: "number",
  string: "string",
  boolean: "boolean",
  keyword: "keyword",
  nil: "nil",
  symbol: "symbol",
  list: "list",
  vector: "vector",
  map: "map",
  function: "function",
  nativeFunction: "native-function",
  macro: "macro",
  multiMethod: "multi-method",
  atom: "atom",
  reduced: "reduced",
  volatile: "volatile",
  regex: "regex",
  var: "var"
};
var tokenKeywords = {
  LParen: "LParen",
  RParen: "RParen",
  LBracket: "LBracket",
  RBracket: "RBracket",
  LBrace: "LBrace",
  RBrace: "RBrace",
  String: "String",
  Number: "Number",
  Keyword: "Keyword",
  Quote: "Quote",
  Quasiquote: "Quasiquote",
  Unquote: "Unquote",
  UnquoteSplicing: "UnquoteSplicing",
  Comment: "Comment",
  Whitespace: "Whitespace",
  Symbol: "Symbol",
  AnonFnStart: "AnonFnStart",
  Deref: "Deref",
  Regex: "Regex",
  VarQuote: "VarQuote",
  Meta: "Meta"
};
var tokenSymbols = {
  Quote: "quote",
  Quasiquote: "quasiquote",
  Unquote: "unquote",
  UnquoteSplicing: "unquote-splicing",
  LParen: "(",
  RParen: ")",
  LBracket: "[",
  RBracket: "]",
  LBrace: "{",
  RBrace: "}"
};

// src/core/errors.ts
class TokenizerError extends Error {
  context;
  constructor(message, context) {
    super(message);
    this.name = "TokenizerError";
    this.context = context;
  }
}

class ReaderError extends Error {
  context;
  pos;
  constructor(message, context, pos) {
    super(message);
    this.name = "ReaderError";
    this.context = context;
    this.pos = pos;
  }
}

class EvaluationError extends Error {
  context;
  pos;
  data;
  constructor(message, context, pos) {
    super(message);
    this.name = "EvaluationError";
    this.context = context;
    this.pos = pos;
  }
  static atArg(message, context, argIndex) {
    const err = new EvaluationError(message, context);
    err.data = { argIndex };
    return err;
  }
}

class CljThrownSignal {
  value;
  constructor(value) {
    this.value = value;
  }
}

// src/core/factories.ts
var cljNumber = (value) => ({ kind: "number", value });
var cljString = (value) => ({ kind: "string", value });
var cljBoolean = (value) => ({ kind: "boolean", value });
var cljKeyword = (name) => ({ kind: "keyword", name });
var cljNil = () => ({ kind: "nil", value: null });
var cljSymbol = (name) => ({ kind: "symbol", name });
var cljList = (value) => ({ kind: "list", value });
var cljVector = (value) => ({ kind: "vector", value });
var cljMap = (entries) => ({ kind: "map", entries });
var cljMultiArityFunction = (arities, env) => ({
  kind: "function",
  arities,
  env
});
var cljNativeFunction = (name, fn) => ({ kind: "native-function", name, fn });
var cljNativeFunctionWithContext = (name, fn) => ({
  kind: "native-function",
  name,
  fn: () => {
    throw new EvaluationError("Native function called without context", {
      name
    });
  },
  fnWithContext: fn
});
var cljMultiArityMacro = (arities, env) => ({
  kind: "macro",
  arities,
  env
});
var cljRegex = (pattern, flags = "") => ({
  kind: "regex",
  pattern,
  flags
});
var cljVar = (ns, name, value, meta) => ({ kind: "var", ns, name, value, meta });
var cljAtom = (value) => ({ kind: "atom", value });
var cljReduced = (value) => ({
  kind: "reduced",
  value
});
var cljVolatile = (value) => ({
  kind: "volatile",
  value
});
var withDoc = (fn, doc, arglists) => ({
  ...fn,
  meta: cljMap([
    [cljKeyword(":doc"), cljString(doc)],
    ...arglists ? [
      [
        cljKeyword(":arglists"),
        cljVector(arglists.map((args) => cljVector(args.map(cljSymbol))))
      ]
    ] : []
  ])
});
var cljMultiMethod = (name, dispatchFn, methods, defaultMethod) => ({
  kind: "multi-method",
  name,
  dispatchFn,
  methods,
  defaultMethod
});

// src/core/env.ts
class EnvError extends Error {
  context;
  constructor(message, context) {
    super(message);
    this.context = context;
    this.name = "EnvError";
  }
}
function derefValue(val) {
  if (val.kind !== "var")
    return val;
  if (val.dynamic && val.bindingStack && val.bindingStack.length > 0) {
    return val.bindingStack[val.bindingStack.length - 1];
  }
  return val.value;
}
function makeNamespace(name) {
  return { name, vars: new Map, aliases: new Map, readerAliases: new Map };
}
function makeEnv(outer) {
  return {
    bindings: new Map,
    outer: outer ?? null
  };
}
function lookup(name, env) {
  let current = env;
  while (current) {
    const raw = current.bindings.get(name);
    if (raw !== undefined)
      return derefValue(raw);
    const v = current.ns?.vars.get(name);
    if (v !== undefined)
      return derefValue(v);
    current = current.outer;
  }
  throw new EvaluationError(`Symbol ${name} not found`, { name });
}
function tryLookup(name, env) {
  let current = env;
  while (current) {
    const raw = current.bindings.get(name);
    if (raw !== undefined)
      return derefValue(raw);
    const v = current.ns?.vars.get(name);
    if (v !== undefined)
      return derefValue(v);
    current = current.outer;
  }
  return;
}
function internVar(name, value, nsEnv, meta) {
  const ns = nsEnv.ns;
  const existing = ns.vars.get(name);
  if (existing) {
    existing.value = value;
    if (meta)
      existing.meta = meta;
  } else {
    ns.vars.set(name, cljVar(ns.name, name, value, meta));
  }
}
function lookupVar(name, env) {
  let current = env;
  while (current) {
    const raw = current.bindings.get(name);
    if (raw !== undefined && raw.kind === "var")
      return raw;
    const v = current.ns?.vars.get(name);
    if (v !== undefined)
      return v;
    current = current.outer;
  }
  return;
}
function define(name, value, env) {
  env.bindings.set(name, value);
}
function extend(params, args, outer) {
  if (params.length !== args.length) {
    throw new EnvError("Number of parameters and arguments must match", {
      params,
      args,
      outer
    });
  }
  const env = makeEnv(outer);
  for (let i = 0;i < params.length; i++) {
    define(params[i], args[i], env);
  }
  return env;
}
function getRootEnv(env) {
  let current = env;
  while (current?.outer) {
    current = current.outer;
  }
  return current;
}
function getNamespaceEnv(env) {
  let current = env;
  while (current) {
    if (current.ns)
      return current;
    current = current.outer;
  }
  return getRootEnv(env);
}

// src/core/positions.ts
function setPos(val, pos) {
  Object.defineProperty(val, "_pos", {
    value: pos,
    enumerable: false,
    writable: true,
    configurable: true
  });
}
function getPos(val) {
  return val._pos;
}
function getLineCol(source, offset) {
  const lines = source.split(`
`);
  let pos = 0;
  for (let i = 0;i < lines.length; i++) {
    const lineEnd = pos + lines[i].length;
    if (offset <= lineEnd) {
      return { line: i + 1, col: offset - pos, lineText: lines[i] };
    }
    pos = lineEnd + 1;
  }
  const last = lines[lines.length - 1];
  return { line: lines.length, col: last.length, lineText: last };
}
function formatErrorContext(source, pos, opts) {
  const { line, col, lineText } = getLineCol(source, pos.start);
  const absLine = line + (opts?.lineOffset ?? 0);
  const absCol = line === 1 ? col + (opts?.colOffset ?? 0) : col;
  const span = Math.max(1, pos.end - pos.start);
  const caret = " ".repeat(col) + "^".repeat(span);
  return `
  at line ${absLine}, col ${absCol + 1}:
  ${lineText}
  ${caret}`;
}

// src/core/evaluator/destructure.ts
function toSeqSafe(value) {
  if (value.kind === "nil")
    return [];
  if (isList(value))
    return value.value;
  if (isVector(value))
    return value.value;
  throw new EvaluationError(`Cannot destructure ${value.kind} as a sequential collection`, { value });
}
function findMapEntry(map, key) {
  const entry = map.entries.find(([k]) => isEqual(k, key));
  return entry ? entry[1] : undefined;
}
function mapContainsKey(map, key) {
  return map.entries.some(([k]) => isEqual(k, key));
}
function destructureVector(pattern, value, ctx, env) {
  const pairs = [];
  const elems = [...pattern];
  const asIdx = elems.findIndex((e) => isKeyword(e) && e.kind === "keyword" && e.name === ":as");
  if (asIdx !== -1) {
    const asSym = elems[asIdx + 1];
    if (!asSym || !isSymbol(asSym)) {
      throw new EvaluationError(":as must be followed by a symbol", { pattern });
    }
    pairs.push([asSym.name, value]);
    elems.splice(asIdx, 2);
  }
  const ampIdx = elems.findIndex((e) => isSymbol(e) && e.name === "&");
  let restPattern = null;
  let positionalCount;
  if (ampIdx !== -1) {
    restPattern = elems[ampIdx + 1];
    if (!restPattern) {
      throw new EvaluationError("& must be followed by a binding pattern", { pattern });
    }
    positionalCount = ampIdx;
    elems.splice(ampIdx);
  } else {
    positionalCount = elems.length;
  }
  const seq = toSeqSafe(value);
  for (let i = 0;i < positionalCount; i++) {
    pairs.push(...destructureBindings(elems[i], seq[i] ?? cljNil(), ctx, env));
  }
  if (restPattern !== null) {
    const restArgs = seq.slice(positionalCount);
    let restValue;
    if (isMap(restPattern) && restArgs.length > 0) {
      const entries = [];
      for (let i = 0;i < restArgs.length; i += 2) {
        entries.push([restArgs[i], restArgs[i + 1] ?? cljNil()]);
      }
      restValue = { kind: "map", entries };
    } else {
      restValue = restArgs.length > 0 ? cljList(restArgs) : cljNil();
    }
    pairs.push(...destructureBindings(restPattern, restValue, ctx, env));
  }
  return pairs;
}
function destructureMap(pattern, value, ctx, env) {
  const pairs = [];
  const orMapVal = findMapEntry(pattern, cljKeyword(":or"));
  const orMap = orMapVal && isMap(orMapVal) ? orMapVal : null;
  const asVal = findMapEntry(pattern, cljKeyword(":as"));
  if (!isMap(value) && value.kind !== "nil") {
    throw new EvaluationError(`Cannot destructure ${value.kind} as a map`, { value, pattern });
  }
  const targetMap = value.kind === "nil" ? { kind: "map", entries: [] } : value;
  for (const [k, v] of pattern.entries) {
    if (isKeyword(k) && k.name === ":or")
      continue;
    if (isKeyword(k) && k.name === ":as")
      continue;
    if (isKeyword(k) && k.name === ":keys") {
      if (!isVector(v)) {
        throw new EvaluationError(":keys must be followed by a vector of symbols", { pattern });
      }
      for (const sym of v.value) {
        if (!isSymbol(sym)) {
          throw new EvaluationError(":keys vector must contain symbols", { pattern, sym });
        }
        const slashIdx = sym.name.indexOf("/");
        const localName = slashIdx !== -1 ? sym.name.slice(slashIdx + 1) : sym.name;
        const lookupKey = cljKeyword(":" + sym.name);
        const present2 = mapContainsKey(targetMap, lookupKey);
        const entry2 = present2 ? findMapEntry(targetMap, lookupKey) : undefined;
        let result;
        if (present2) {
          result = entry2;
        } else if (orMap) {
          const orDefault = findMapEntry(orMap, cljSymbol(localName));
          result = orDefault !== undefined ? ctx.evaluate(orDefault, env) : cljNil();
        } else {
          result = cljNil();
        }
        pairs.push([localName, result]);
      }
      continue;
    }
    if (isKeyword(k) && k.name === ":strs") {
      if (!isVector(v)) {
        throw new EvaluationError(":strs must be followed by a vector of symbols", { pattern });
      }
      for (const sym of v.value) {
        if (!isSymbol(sym)) {
          throw new EvaluationError(":strs vector must contain symbols", { pattern, sym });
        }
        const lookupKey = cljString(sym.name);
        const present2 = mapContainsKey(targetMap, lookupKey);
        const entry2 = present2 ? findMapEntry(targetMap, lookupKey) : undefined;
        let result;
        if (present2) {
          result = entry2;
        } else if (orMap) {
          const orDefault = findMapEntry(orMap, cljSymbol(sym.name));
          result = orDefault !== undefined ? ctx.evaluate(orDefault, env) : cljNil();
        } else {
          result = cljNil();
        }
        pairs.push([sym.name, result]);
      }
      continue;
    }
    if (isKeyword(k) && k.name === ":syms") {
      if (!isVector(v)) {
        throw new EvaluationError(":syms must be followed by a vector of symbols", { pattern });
      }
      for (const sym of v.value) {
        if (!isSymbol(sym)) {
          throw new EvaluationError(":syms vector must contain symbols", { pattern, sym });
        }
        const lookupKey = cljSymbol(sym.name);
        const present2 = mapContainsKey(targetMap, lookupKey);
        const entry2 = present2 ? findMapEntry(targetMap, lookupKey) : undefined;
        let result;
        if (present2) {
          result = entry2;
        } else if (orMap) {
          const orDefault = findMapEntry(orMap, cljSymbol(sym.name));
          result = orDefault !== undefined ? ctx.evaluate(orDefault, env) : cljNil();
        } else {
          result = cljNil();
        }
        pairs.push([sym.name, result]);
      }
      continue;
    }
    const entry = findMapEntry(targetMap, v);
    const present = mapContainsKey(targetMap, v);
    let boundVal;
    if (present) {
      boundVal = entry;
    } else if (orMap && isSymbol(k)) {
      const orDefault = findMapEntry(orMap, cljSymbol(k.name));
      boundVal = orDefault !== undefined ? ctx.evaluate(orDefault, env) : cljNil();
    } else {
      boundVal = cljNil();
    }
    pairs.push(...destructureBindings(k, boundVal, ctx, env));
  }
  if (asVal && isSymbol(asVal)) {
    pairs.push([asVal.name, value]);
  }
  return pairs;
}
function destructureBindings(pattern, value, ctx, env) {
  if (isSymbol(pattern)) {
    return [[pattern.name, value]];
  }
  if (isVector(pattern)) {
    return destructureVector(pattern.value, value, ctx, env);
  }
  if (isMap(pattern)) {
    return destructureMap(pattern, value, ctx, env);
  }
  throw new EvaluationError(`Invalid destructuring pattern: expected symbol, vector, or map, got ${pattern.kind}`, { pattern });
}

// src/core/evaluator/arity.ts
class RecurSignal {
  args;
  constructor(args) {
    this.args = args;
  }
}
function parseParamVector(args, env) {
  const ampIdx = args.value.findIndex((a) => isSymbol(a) && a.name === "&");
  let params = [];
  let restParam = null;
  if (ampIdx === -1) {
    params = args.value;
  } else {
    const ampsCount = args.value.filter((a) => isSymbol(a) && a.name === "&").length;
    if (ampsCount > 1) {
      throw new EvaluationError("& can only appear once", { args, env });
    }
    if (ampIdx !== args.value.length - 2) {
      throw new EvaluationError("& must be second-to-last argument", {
        args,
        env
      });
    }
    params = args.value.slice(0, ampIdx);
    restParam = args.value[ampIdx + 1];
  }
  return { params, restParam };
}
function parseArities(forms, env) {
  if (forms.length === 0) {
    throw new EvaluationError("fn/defmacro requires at least a parameter vector", {
      forms,
      env
    });
  }
  if (isVector(forms[0])) {
    const paramVec = forms[0];
    const { params, restParam } = parseParamVector(paramVec, env);
    return [{ params, restParam, body: forms.slice(1) }];
  }
  if (isList(forms[0])) {
    const arities = [];
    for (const form of forms) {
      if (!isList(form) || form.value.length === 0) {
        throw new EvaluationError("Multi-arity clause must be a list starting with a parameter vector", { form, env });
      }
      const paramVec = form.value[0];
      if (!isVector(paramVec)) {
        throw new EvaluationError("First element of arity clause must be a parameter vector", { paramVec, env });
      }
      const { params, restParam } = parseParamVector(paramVec, env);
      arities.push({ params, restParam, body: form.value.slice(1) });
    }
    const variadicCount = arities.filter((a) => a.restParam !== null).length;
    if (variadicCount > 1) {
      throw new EvaluationError("At most one variadic arity is allowed per function", { forms, env });
    }
    return arities;
  }
  throw new EvaluationError("fn/defmacro expects a parameter vector or arity clauses", { forms, env });
}
function bindParams(params, restParam, args, outerEnv, ctx, bindEnv) {
  if (restParam === null) {
    if (args.length !== params.length) {
      throw new EvaluationError(`Arguments length mismatch: fn accepts ${params.length} arguments, but ${args.length} were provided`, { params, args, outerEnv });
    }
  } else {
    if (args.length < params.length) {
      throw new EvaluationError(`Arguments length mismatch: fn expects at least ${params.length} arguments, but ${args.length} were provided`, { params, args, outerEnv });
    }
  }
  const allPairs = [];
  for (let i = 0;i < params.length; i++) {
    allPairs.push(...destructureBindings(params[i], args[i], ctx, bindEnv));
  }
  if (restParam !== null) {
    const restArgs = args.slice(params.length);
    let restValue;
    if (isMap(restParam) && restArgs.length > 0) {
      const entries = [];
      for (let i = 0;i < restArgs.length; i += 2) {
        entries.push([restArgs[i], restArgs[i + 1] ?? cljNil()]);
      }
      restValue = { kind: "map", entries };
    } else {
      restValue = restArgs.length > 0 ? cljList(restArgs) : cljNil();
    }
    allPairs.push(...destructureBindings(restParam, restValue, ctx, bindEnv));
  }
  return extend(allPairs.map(([n]) => n), allPairs.map(([, v]) => v), outerEnv);
}
function resolveArity(arities, argCount) {
  const exactMatch = arities.find((a) => a.restParam === null && a.params.length === argCount);
  if (exactMatch)
    return exactMatch;
  const variadicMatch = arities.find((a) => a.restParam !== null && argCount >= a.params.length);
  if (variadicMatch)
    return variadicMatch;
  const counts = arities.map((a) => a.restParam ? `${a.params.length}+` : `${a.params.length}`);
  throw new EvaluationError(`No matching arity for ${argCount} arguments. Available arities: ${counts.join(", ")}`, { arities, argCount });
}

// src/core/gensym.ts
var _counter = 0;
function makeGensym(prefix = "G") {
  return `${prefix}__${_counter++}`;
}

// src/core/evaluator/quasiquote.ts
function evaluateQuasiquote(form, env, autoGensyms = new Map, ctx) {
  switch (form.kind) {
    case valueKeywords.vector:
    case valueKeywords.list: {
      const isAList = isList(form);
      if (isAList && form.value.length === 2 && isSymbol(form.value[0]) && form.value[0].name === "unquote") {
        return ctx.evaluate(form.value[1], env);
      }
      const elements = [];
      for (const elem of form.value) {
        if (isList(elem) && elem.value.length === 2 && isSymbol(elem.value[0]) && elem.value[0].name === "unquote-splicing") {
          const toSplice = ctx.evaluate(elem.value[1], env);
          if (!isList(toSplice) && !isVector(toSplice)) {
            throw new EvaluationError("Unquote-splicing must evaluate to a list or vector", { elem, env });
          }
          elements.push(...toSplice.value);
          continue;
        }
        elements.push(evaluateQuasiquote(elem, env, autoGensyms, ctx));
      }
      return isAList ? cljList(elements) : cljVector(elements);
    }
    case valueKeywords.map: {
      const entries = [];
      for (const [key, value] of form.entries) {
        const evaluatedKey = evaluateQuasiquote(key, env, autoGensyms, ctx);
        const evaluatedValue = evaluateQuasiquote(value, env, autoGensyms, ctx);
        entries.push([evaluatedKey, evaluatedValue]);
      }
      return cljMap(entries);
    }
    case valueKeywords.number:
    case valueKeywords.string:
    case valueKeywords.boolean:
    case valueKeywords.keyword:
    case valueKeywords.nil:
      return form;
    case valueKeywords.symbol: {
      if (form.name.endsWith("#")) {
        if (!autoGensyms.has(form.name)) {
          autoGensyms.set(form.name, makeGensym(form.name.slice(0, -1)));
        }
        return { kind: "symbol", name: autoGensyms.get(form.name) };
      }
      return form;
    }
    default:
      throw new EvaluationError(`Unexpected form: ${form.kind}`, { form, env });
  }
}

// src/core/evaluator/recur-check.ts
function assertRecurInTailPosition(body) {
  validateForms(body, true);
}
function isRecurForm(form) {
  return isList(form) && form.value.length >= 1 && isSymbol(form.value[0]) && form.value[0].name === specialFormKeywords.recur;
}
function validateForms(forms, inTail) {
  for (let i = 0;i < forms.length; i++) {
    validateForm(forms[i], inTail && i === forms.length - 1);
  }
}
function validateForm(form, inTail) {
  if (!isList(form))
    return;
  if (isRecurForm(form)) {
    if (!inTail) {
      throw new EvaluationError("Can only recur from tail position", { form });
    }
    return;
  }
  if (form.value.length === 0)
    return;
  const first = form.value[0];
  if (!isSymbol(first)) {
    for (const sub of form.value)
      validateForm(sub, false);
    return;
  }
  const name = first.name;
  if (name === specialFormKeywords.fn || name === specialFormKeywords.loop || name === specialFormKeywords.quote || name === specialFormKeywords.quasiquote) {
    return;
  }
  if (name === specialFormKeywords.if) {
    if (form.value[1])
      validateForm(form.value[1], false);
    if (form.value[2])
      validateForm(form.value[2], inTail);
    if (form.value[3])
      validateForm(form.value[3], inTail);
    return;
  }
  if (name === specialFormKeywords.do) {
    validateForms(form.value.slice(1), inTail);
    return;
  }
  if (name === specialFormKeywords.let) {
    const bindings = form.value[1];
    if (isVector(bindings)) {
      for (let i = 1;i < bindings.value.length; i += 2) {
        validateForm(bindings.value[i], false);
      }
    }
    validateForms(form.value.slice(2), inTail);
    return;
  }
  for (const sub of form.value.slice(1)) {
    validateForm(sub, false);
  }
}

// src/core/evaluator/special-forms.ts
function hasDynamicMeta(meta) {
  if (!meta)
    return false;
  for (const [k, v] of meta.entries) {
    if (k.kind === "keyword" && k.name === ":dynamic" && v.kind === "boolean" && v.value === true) {
      return true;
    }
  }
  return false;
}
var specialFormKeywords = {
  quote: "quote",
  def: "def",
  if: "if",
  do: "do",
  let: "let",
  fn: "fn",
  defmacro: "defmacro",
  quasiquote: "quasiquote",
  ns: "ns",
  loop: "loop",
  recur: "recur",
  defmulti: "defmulti",
  defmethod: "defmethod",
  try: "try",
  var: "var",
  binding: "binding",
  "set!": "set!"
};
function keywordToDispatchFn(kw) {
  return cljNativeFunction(`kw:${kw.name}`, (...args) => {
    const target = args[0];
    if (!isMap(target))
      return cljNil();
    const entry = target.entries.find(([k]) => isEqual(k, kw));
    return entry ? entry[1] : cljNil();
  });
}
function evaluateTry(list, env, ctx) {
  const forms = list.value.slice(1);
  const bodyForms = [];
  const catchClauses = [];
  let finallyForms = null;
  for (let i = 0;i < forms.length; i++) {
    const form = forms[i];
    if (isList(form) && form.value.length > 0 && isSymbol(form.value[0])) {
      const head = form.value[0].name;
      if (head === "catch") {
        if (form.value.length < 3) {
          throw new EvaluationError("catch requires a discriminator and a binding symbol", { form, env });
        }
        const discriminator = form.value[1];
        const bindingSym = form.value[2];
        if (!isSymbol(bindingSym)) {
          throw new EvaluationError("catch binding must be a symbol", {
            form,
            env
          });
        }
        catchClauses.push({
          discriminator,
          binding: bindingSym.name,
          body: form.value.slice(3)
        });
        continue;
      }
      if (head === "finally") {
        if (i !== forms.length - 1) {
          throw new EvaluationError("finally clause must be the last in try expression", {
            form,
            env
          });
        }
        finallyForms = form.value.slice(1);
        continue;
      }
    }
    bodyForms.push(form);
  }
  function matchesDiscriminator(discriminator, thrown) {
    const disc = ctx.evaluate(discriminator, env);
    if (isKeyword(disc)) {
      if (disc.name === ":default")
        return true;
      if (!isMap(thrown))
        return false;
      const typeEntry = thrown.entries.find(([k]) => isKeyword(k) && k.name === ":type");
      if (!typeEntry)
        return false;
      return isEqual(typeEntry[1], disc);
    }
    if (isAFunction(disc)) {
      const result2 = ctx.applyFunction(disc, [thrown], env);
      return isTruthy(result2);
    }
    throw new EvaluationError("catch discriminator must be a keyword or a predicate function", { discriminator: disc, env });
  }
  let result = cljNil();
  let pendingThrow = null;
  try {
    result = ctx.evaluateForms(bodyForms, env);
  } catch (e) {
    if (e instanceof RecurSignal)
      throw e;
    let thrownValue;
    if (e instanceof CljThrownSignal) {
      thrownValue = e.value;
    } else if (e instanceof EvaluationError) {
      thrownValue = cljMap([
        [cljKeyword(":type"), cljKeyword(":error/runtime")],
        [cljKeyword(":message"), cljString(e.message)]
      ]);
    } else {
      throw e;
    }
    let handled = false;
    for (const clause of catchClauses) {
      if (matchesDiscriminator(clause.discriminator, thrownValue)) {
        const catchEnv = extend([clause.binding], [thrownValue], env);
        result = ctx.evaluateForms(clause.body, catchEnv);
        handled = true;
        break;
      }
    }
    if (!handled) {
      pendingThrow = e;
    }
  } finally {
    if (finallyForms) {
      ctx.evaluateForms(finallyForms, env);
    }
  }
  if (pendingThrow !== null)
    throw pendingThrow;
  return result;
}
function evaluateQuote(list, _env, _ctx) {
  return list.value[1];
}
function evalQuasiquote(list, env, ctx) {
  return evaluateQuasiquote(list.value[1], env, new Map, ctx);
}
function buildVarMeta(symMeta, ctx, nameVal) {
  const pos = nameVal ? getPos(nameVal) : undefined;
  const hasPosInfo = pos && ctx.currentSource;
  if (!symMeta && !hasPosInfo)
    return;
  const posEntries = [];
  if (hasPosInfo) {
    const { line, col } = getLineCol(ctx.currentSource, pos.start);
    const lineOffset = ctx.currentLineOffset ?? 0;
    const colOffset = ctx.currentColOffset ?? 0;
    posEntries.push([cljKeyword(":line"), cljNumber(line + lineOffset)]);
    posEntries.push([cljKeyword(":column"), cljNumber(line === 1 ? col + colOffset : col)]);
    if (ctx.currentFile) {
      posEntries.push([cljKeyword(":file"), cljString(ctx.currentFile)]);
    }
  }
  const POS_KEYS = new Set([":line", ":column", ":file"]);
  const baseEntries = (symMeta?.entries ?? []).filter(([k]) => !(k.kind === "keyword" && POS_KEYS.has(k.name)));
  const allEntries = [...baseEntries, ...posEntries];
  return allEntries.length > 0 ? cljMap(allEntries) : undefined;
}
function evaluateDef(list, env, ctx) {
  const name = list.value[1];
  if (name.kind !== "symbol") {
    throw new EvaluationError("First element of list must be a symbol", {
      name,
      list,
      env
    });
  }
  if (list.value[2] === undefined)
    return cljNil();
  const nsEnv = getNamespaceEnv(env);
  const cljNs = nsEnv.ns;
  const newValue = ctx.evaluate(list.value[2], env);
  const varMeta = buildVarMeta(name.meta, ctx, name);
  const existing = cljNs.vars.get(name.name);
  if (existing) {
    existing.value = newValue;
    if (varMeta) {
      existing.meta = varMeta;
      if (hasDynamicMeta(varMeta))
        existing.dynamic = true;
    }
  } else {
    const v = cljVar(cljNs.name, name.name, newValue, varMeta);
    if (hasDynamicMeta(varMeta))
      v.dynamic = true;
    cljNs.vars.set(name.name, v);
  }
  return cljNil();
}
var evaluateNs = (_list, _env, _ctx) => {
  return cljNil();
};
function evaluateIf(list, env, ctx) {
  const condition = ctx.evaluate(list.value[1], env);
  if (!isFalsy(condition)) {
    return ctx.evaluate(list.value[2], env);
  }
  if (!list.value[3]) {
    return cljNil();
  }
  return ctx.evaluate(list.value[3], env);
}
function evaluateDo(list, env, ctx) {
  return ctx.evaluateForms(list.value.slice(1), env);
}
function evaluateLet(list, env, ctx) {
  const bindings = list.value[1];
  if (!isVector(bindings)) {
    throw new EvaluationError("Bindings must be a vector", {
      bindings,
      env
    });
  }
  if (bindings.value.length % 2 !== 0) {
    throw new EvaluationError("Bindings must be a balanced pair of keys and values", { bindings, env });
  }
  const body = list.value.slice(2);
  let localEnv = env;
  for (let i = 0;i < bindings.value.length; i += 2) {
    const pattern = bindings.value[i];
    const value = ctx.evaluate(bindings.value[i + 1], localEnv);
    const pairs = destructureBindings(pattern, value, ctx, localEnv);
    localEnv = extend(pairs.map(([n]) => n), pairs.map(([, v]) => v), localEnv);
  }
  return ctx.evaluateForms(body, localEnv);
}
function evaluateFn(list, env, _ctx) {
  const arities = parseArities(list.value.slice(1), env);
  for (const arity of arities) {
    assertRecurInTailPosition(arity.body);
  }
  return cljMultiArityFunction(arities, env);
}
function evaluateDefmacro(list, env, _ctx) {
  const name = list.value[1];
  if (!isSymbol(name)) {
    throw new EvaluationError("First element of defmacro must be a symbol", {
      name,
      list,
      env
    });
  }
  const arities = parseArities(list.value.slice(2), env);
  const macro = cljMultiArityMacro(arities, env);
  internVar(name.name, macro, getNamespaceEnv(env));
  return cljNil();
}
function evaluateLoop(list, env, ctx) {
  const loopBindings = list.value[1];
  if (!isVector(loopBindings)) {
    throw new EvaluationError("loop bindings must be a vector", {
      loopBindings,
      env
    });
  }
  if (loopBindings.value.length % 2 !== 0) {
    throw new EvaluationError("loop bindings must be a balanced pair of keys and values", { loopBindings, env });
  }
  const loopBody = list.value.slice(2);
  assertRecurInTailPosition(loopBody);
  const patterns = [];
  const initValues = [];
  let initEnv = env;
  for (let i = 0;i < loopBindings.value.length; i += 2) {
    const pattern = loopBindings.value[i];
    const value = ctx.evaluate(loopBindings.value[i + 1], initEnv);
    patterns.push(pattern);
    initValues.push(value);
    const pairs = destructureBindings(pattern, value, ctx, initEnv);
    initEnv = extend(pairs.map(([n]) => n), pairs.map(([, v]) => v), initEnv);
  }
  let currentValues = initValues;
  while (true) {
    let loopEnv = env;
    for (let i = 0;i < patterns.length; i++) {
      const pairs = destructureBindings(patterns[i], currentValues[i], ctx, loopEnv);
      loopEnv = extend(pairs.map(([n]) => n), pairs.map(([, v]) => v), loopEnv);
    }
    try {
      return ctx.evaluateForms(loopBody, loopEnv);
    } catch (e) {
      if (e instanceof RecurSignal) {
        if (e.args.length !== patterns.length) {
          throw new EvaluationError(`recur expects ${patterns.length} arguments but got ${e.args.length}`, { list, env });
        }
        currentValues = e.args;
        continue;
      }
      throw e;
    }
  }
}
function evaluateRecur(list, env, ctx) {
  const args = list.value.slice(1).map((v) => ctx.evaluate(v, env));
  throw new RecurSignal(args);
}
function evaluateDefmulti(list, env, ctx) {
  const mmName = list.value[1];
  if (!isSymbol(mmName)) {
    throw new EvaluationError("defmulti: first argument must be a symbol", {
      list,
      env
    });
  }
  const dispatchFnExpr = list.value[2];
  let dispatchFn;
  if (isKeyword(dispatchFnExpr)) {
    dispatchFn = keywordToDispatchFn(dispatchFnExpr);
  } else {
    const evaluated = ctx.evaluate(dispatchFnExpr, env);
    if (!isAFunction(evaluated)) {
      throw new EvaluationError("defmulti: dispatch-fn must be a function or keyword", { list, env });
    }
    dispatchFn = evaluated;
  }
  const mm = cljMultiMethod(mmName.name, dispatchFn, []);
  internVar(mmName.name, mm, getNamespaceEnv(env));
  return cljNil();
}
function evaluateDefmethod(list, env, ctx) {
  const mmName = list.value[1];
  if (!isSymbol(mmName)) {
    throw new EvaluationError("defmethod: first argument must be a symbol", {
      list,
      env
    });
  }
  const dispatchVal = ctx.evaluate(list.value[2], env);
  const existing = lookup(mmName.name, env);
  if (!isMultiMethod(existing)) {
    throw new EvaluationError(`defmethod: ${mmName.name} is not a multimethod`, { list, env });
  }
  const arities = parseArities([list.value[3], ...list.value.slice(4)], env);
  const methodFn = cljMultiArityFunction(arities, env);
  const isDefault = isKeyword(dispatchVal) && dispatchVal.name === ":default";
  let updated;
  if (isDefault) {
    updated = cljMultiMethod(existing.name, existing.dispatchFn, existing.methods, methodFn);
  } else {
    const filtered = existing.methods.filter((m) => !isEqual(m.dispatchVal, dispatchVal));
    updated = cljMultiMethod(existing.name, existing.dispatchFn, [
      ...filtered,
      { dispatchVal, fn: methodFn }
    ]);
  }
  const v = lookupVar(mmName.name, env);
  if (v) {
    v.value = updated;
  } else {
    define(mmName.name, updated, getNamespaceEnv(env));
  }
  return cljNil();
}
function evaluateVar(list, env, _ctx) {
  const sym = list.value[1];
  if (!isSymbol(sym)) {
    throw new EvaluationError("var expects a symbol", { list });
  }
  const slashIdx = sym.name.indexOf("/");
  if (slashIdx > 0 && slashIdx < sym.name.length - 1) {
    const alias = sym.name.slice(0, slashIdx);
    const localName = sym.name.slice(slashIdx + 1);
    const nsEnv = getNamespaceEnv(env);
    const aliasCljNs = nsEnv.ns?.aliases.get(alias);
    if (aliasCljNs) {
      const v3 = aliasCljNs.vars.get(localName);
      if (!v3)
        throw new EvaluationError(`Var ${sym.name} not found`, { sym });
      return v3;
    }
    const targetEnv = getRootEnv(env).resolveNs?.(alias) ?? null;
    if (!targetEnv) {
      throw new EvaluationError(`No such namespace: ${alias}`, { sym });
    }
    const v2 = lookupVar(localName, targetEnv);
    if (!v2)
      throw new EvaluationError(`Var ${sym.name} not found`, { sym });
    return v2;
  }
  const v = lookupVar(sym.name, env);
  if (!v) {
    throw new EvaluationError(`Unable to resolve var: ${sym.name} in this context`, { sym });
  }
  return v;
}
function evaluateBinding(list, env, ctx) {
  const bindings = list.value[1];
  if (!isVector(bindings)) {
    throw new EvaluationError("binding requires a vector of bindings", {
      list,
      env
    });
  }
  if (bindings.value.length % 2 !== 0) {
    throw new EvaluationError("binding vector must have an even number of forms", { list, env });
  }
  const body = list.value.slice(2);
  const boundVars = [];
  for (let i = 0;i < bindings.value.length; i += 2) {
    const sym = bindings.value[i];
    if (!isSymbol(sym)) {
      throw new EvaluationError("binding left-hand side must be a symbol", { sym });
    }
    const newVal = ctx.evaluate(bindings.value[i + 1], env);
    const v = lookupVar(sym.name, env);
    if (!v) {
      throw new EvaluationError(`No var found for symbol '${sym.name}' in binding form`, { sym });
    }
    if (!v.dynamic) {
      throw new EvaluationError(`Cannot use binding with non-dynamic var ${v.ns}/${v.name}. Mark it dynamic with (def ^:dynamic ${sym.name} ...)`, { sym });
    }
    v.bindingStack ??= [];
    v.bindingStack.push(newVal);
    boundVars.push(v);
  }
  try {
    return ctx.evaluateForms(body, env);
  } finally {
    for (const v of boundVars) {
      v.bindingStack.pop();
    }
  }
}
function evaluateSet(list, env, ctx) {
  if (list.value.length !== 3) {
    throw new EvaluationError(`set! requires exactly 2 arguments, got ${list.value.length - 1}`, { list, env });
  }
  const symForm = list.value[1];
  if (!isSymbol(symForm)) {
    throw new EvaluationError(`set! first argument must be a symbol, got ${symForm.kind}`, { symForm, env });
  }
  const v = lookupVar(symForm.name, env);
  if (!v) {
    throw new EvaluationError(`Unable to resolve var: ${symForm.name} in this context`, { symForm, env });
  }
  if (!v.dynamic) {
    throw new EvaluationError(`Cannot set! non-dynamic var ${v.ns}/${v.name}. Mark it with ^:dynamic.`, { symForm, env });
  }
  if (!v.bindingStack || v.bindingStack.length === 0) {
    throw new EvaluationError(`Cannot set! ${v.ns}/${v.name} — no active binding. Use set! only inside a (binding [...] ...) form.`, { symForm, env });
  }
  const newVal = ctx.evaluate(list.value[2], env);
  v.bindingStack[v.bindingStack.length - 1] = newVal;
  return newVal;
}
var specialFormEvaluatorEntries = {
  try: evaluateTry,
  quote: evaluateQuote,
  quasiquote: evalQuasiquote,
  def: evaluateDef,
  ns: evaluateNs,
  if: evaluateIf,
  do: evaluateDo,
  let: evaluateLet,
  fn: evaluateFn,
  defmacro: evaluateDefmacro,
  loop: evaluateLoop,
  recur: evaluateRecur,
  defmulti: evaluateDefmulti,
  defmethod: evaluateDefmethod,
  var: evaluateVar,
  binding: evaluateBinding,
  "set!": evaluateSet
};
function evaluateSpecialForm(symbol, list, env, ctx) {
  const evalFn = specialFormEvaluatorEntries[symbol];
  if (evalFn) {
    return evalFn(list, env, ctx);
  }
  throw new EvaluationError(`Unknown special form: ${symbol}`, {
    symbol,
    list,
    env
  });
}

// src/core/assertions.ts
var isNil = (value) => value.kind === "nil";
var isFalsy = (value) => {
  if (value.kind === "nil")
    return true;
  if (value.kind === "boolean")
    return !value.value;
  return false;
};
var isTruthy = (value) => {
  return !isFalsy(value);
};
var isSpecialForm = (value) => value.kind === "symbol" && (value.name in specialFormKeywords);
var isSymbol = (value) => value.kind === "symbol";
var isVector = (value) => value.kind === "vector";
var isList = (value) => value.kind === "list";
var isFunction = (value) => value.kind === "function";
var isNativeFunction = (value) => value.kind === "native-function";
var isMacro = (value) => value.kind === "macro";
var isMap = (value) => value.kind === "map";
var isKeyword = (value) => value.kind === "keyword";
var isAFunction = (value) => isFunction(value) || isNativeFunction(value);
var isCallable = (value) => isAFunction(value) || isKeyword(value) || isMap(value);
var isMultiMethod = (value) => value.kind === "multi-method";
var isAtom = (value) => value.kind === "atom";
var isReduced = (value) => value.kind === "reduced";
var isVolatile = (value) => value.kind === "volatile";
var isRegex = (value) => value.kind === "regex";
var isVar = (value) => value.kind === "var";
var isCollection = (value) => isVector(value) || isMap(value) || isList(value);
var isSeqable = (value) => isCollection(value) || value.kind === "string";
var equalityHandlers = {
  [valueKeywords.number]: (a, b) => a.value === b.value,
  [valueKeywords.string]: (a, b) => a.value === b.value,
  [valueKeywords.boolean]: (a, b) => a.value === b.value,
  [valueKeywords.nil]: () => true,
  [valueKeywords.symbol]: (a, b) => a.name === b.name,
  [valueKeywords.keyword]: (a, b) => a.name === b.name,
  [valueKeywords.vector]: (a, b) => {
    if (a.value.length !== b.value.length)
      return false;
    return a.value.every((value, index) => isEqual(value, b.value[index]));
  },
  [valueKeywords.map]: (a, b) => {
    if (a.entries.length !== b.entries.length)
      return false;
    const uniqueKeys = new Set([
      ...a.entries.map(([key]) => key),
      ...b.entries.map(([key]) => key)
    ]);
    for (const key of uniqueKeys) {
      const aEntry = a.entries.find(([k]) => isEqual(k, key));
      if (!aEntry)
        return false;
      const bEntry = b.entries.find(([k]) => isEqual(k, key));
      if (!bEntry)
        return false;
      if (!isEqual(aEntry[1], bEntry[1]))
        return false;
    }
    return true;
  },
  [valueKeywords.list]: (a, b) => {
    if (a.value.length !== b.value.length)
      return false;
    return a.value.every((value, index) => isEqual(value, b.value[index]));
  },
  [valueKeywords.atom]: (a, b) => a === b,
  [valueKeywords.reduced]: (a, b) => isEqual(a.value, b.value),
  [valueKeywords.volatile]: (a, b) => a === b,
  [valueKeywords.regex]: (a, b) => a === b,
  [valueKeywords.var]: (a, b) => a === b
};
var isEqual = (a, b) => {
  if (a.kind !== b.kind)
    return false;
  const handler = equalityHandlers[a.kind];
  if (!handler)
    return false;
  return handler(a, b);
};

// src/core/printer.ts
function printString(value) {
  switch (value.kind) {
    case valueKeywords.number:
      return value.value.toString();
    case valueKeywords.string:
      let escapedBuffer = "";
      for (const char of value.value) {
        switch (char) {
          case '"':
            escapedBuffer += "\\\"";
            break;
          case "\\":
            escapedBuffer += "\\\\";
            break;
          case `
`:
            escapedBuffer += "\\n";
            break;
          case "\r":
            escapedBuffer += "\\r";
            break;
          case "\t":
            escapedBuffer += "\\t";
            break;
          default:
            escapedBuffer += char;
        }
      }
      return `"${escapedBuffer}"`;
    case valueKeywords.boolean:
      return value.value ? "true" : "false";
    case valueKeywords.nil:
      return "nil";
    case valueKeywords.keyword:
      return `${value.name}`;
    case valueKeywords.symbol:
      return `${value.name}`;
    case valueKeywords.list:
      return `(${value.value.map(printString).join(" ")})`;
    case valueKeywords.vector:
      return `[${value.value.map(printString).join(" ")}]`;
    case valueKeywords.map:
      return `{${value.entries.map(([key, value2]) => `${printString(key)} ${printString(value2)}`).join(" ")}}`;
    case valueKeywords.function: {
      if (value.arities.length === 1) {
        const a = value.arities[0];
        const params = a.restParam ? [...a.params, { kind: "symbol", name: "&" }, a.restParam] : a.params;
        return `(fn [${params.map(printString).join(" ")}] ${a.body.map(printString).join(" ")})`;
      }
      const clauses = value.arities.map((a) => {
        const params = a.restParam ? [...a.params, { kind: "symbol", name: "&" }, a.restParam] : a.params;
        return `([${params.map(printString).join(" ")}] ${a.body.map(printString).join(" ")})`;
      });
      return `(fn ${clauses.join(" ")})`;
    }
    case valueKeywords.nativeFunction:
      return `(native-fn ${value.name})`;
    case valueKeywords.multiMethod:
      return `(multi-method ${value.name})`;
    case valueKeywords.atom:
      return `#<Atom ${printString(value.value)}>`;
    case valueKeywords.reduced:
      return `#<Reduced ${printString(value.value)}>`;
    case valueKeywords.volatile:
      return `#<Volatile ${printString(value.value)}>`;
    case valueKeywords.regex: {
      const escaped = value.pattern.replace(/"/g, "\\\"");
      const prefix = value.flags ? `(?${value.flags})` : "";
      return `#"${prefix}${escaped}"`;
    }
    case valueKeywords.var:
      return `#'${value.ns}/${value.name}`;
    default:
      throw new EvaluationError(`unhandled value type: ${value.kind}`, {
        value
      });
  }
}
function joinLines(lines) {
  return lines.join(`
`);
}

// src/core/stdlib/arithmetic.ts
var arithmeticFunctions = {
  "+": withDoc(cljNativeFunction("+", function add(...nums) {
    if (nums.length === 0) {
      return cljNumber(0);
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("+ expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.reduce(function sumNumbers(acc, arg) {
      return cljNumber(acc.value + arg.value);
    }, cljNumber(0));
  }), "Returns the sum of the arguments. Throws on non-number arguments.", [["&", "nums"]]),
  "-": withDoc(cljNativeFunction("-", function subtract(...nums) {
    if (nums.length === 0) {
      throw new EvaluationError("- expects at least one argument", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("- expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.slice(1).reduce(function subtractNumbers(acc, arg) {
      return cljNumber(acc.value - arg.value);
    }, nums[0]);
  }), "Returns the difference of the arguments. Throws on non-number arguments.", [["&", "nums"]]),
  "*": withDoc(cljNativeFunction("*", function multiply(...nums) {
    if (nums.length === 0) {
      return cljNumber(1);
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("* expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.slice(1).reduce(function multiplyNumbers(acc, arg) {
      return cljNumber(acc.value * arg.value);
    }, nums[0]);
  }), "Returns the product of the arguments. Throws on non-number arguments.", [["&", "nums"]]),
  "/": withDoc(cljNativeFunction("/", function divide(...nums) {
    if (nums.length === 0) {
      throw new EvaluationError("/ expects at least one argument", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("/ expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.slice(1).reduce(function divideNumbers(acc, arg, reduceIdx) {
      if (arg.value === 0) {
        const err = new EvaluationError("division by zero", { args: nums });
        err.data = { argIndex: reduceIdx + 1 };
        throw err;
      }
      return cljNumber(acc.value / arg.value);
    }, nums[0]);
  }), "Returns the quotient of the arguments. Throws on non-number arguments or division by zero.", [["&", "nums"]]),
  ">": withDoc(cljNativeFunction(">", function greaterThan(...nums) {
    if (nums.length < 2) {
      throw new EvaluationError("> expects at least two arguments", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("> expects all arguments to be numbers", { args: nums }, badIdx);
    }
    for (let i = 1;i < nums.length; i++) {
      if (nums[i].value >= nums[i - 1].value) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Compares adjacent arguments left to right, returns true if all values are in ascending order, false otherwise.", [["&", "nums"]]),
  "<": withDoc(cljNativeFunction("<", function lessThan(...nums) {
    if (nums.length < 2) {
      throw new EvaluationError("< expects at least two arguments", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("< expects all arguments to be numbers", { args: nums }, badIdx);
    }
    for (let i = 1;i < nums.length; i++) {
      if (nums[i].value <= nums[i - 1].value) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Compares adjacent arguments left to right, returns true if all values are in descending order, false otherwise.", [["&", "nums"]]),
  ">=": withDoc(cljNativeFunction(">=", function greaterThanOrEqual(...nums) {
    if (nums.length < 2) {
      throw new EvaluationError(">= expects at least two arguments", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg(">= expects all arguments to be numbers", { args: nums }, badIdx);
    }
    for (let i = 1;i < nums.length; i++) {
      if (nums[i].value > nums[i - 1].value) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Compares adjacent arguments left to right, returns true if all comparisons returns true for greater than or equal to checks, false otherwise.", [["&", "nums"]]),
  "<=": withDoc(cljNativeFunction("<=", function lessThanOrEqual(...nums) {
    if (nums.length < 2) {
      throw new EvaluationError("<= expects at least two arguments", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("<= expects all arguments to be numbers", { args: nums }, badIdx);
    }
    for (let i = 1;i < nums.length; i++) {
      if (nums[i].value < nums[i - 1].value) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Compares adjacent arguments left to right, returns true if all comparisons returns true for less than or equal to checks, false otherwise.", [["&", "nums"]]),
  "=": withDoc(cljNativeFunction("=", function equals(...vals) {
    if (vals.length < 2) {
      throw new EvaluationError("= expects at least two arguments", {
        args: vals
      });
    }
    for (let i = 1;i < vals.length; i++) {
      if (!isEqual(vals[i], vals[i - 1])) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Compares adjacent arguments left to right, returns true if all values are structurally equal, false otherwise.", [["&", "vals"]]),
  inc: withDoc(cljNativeFunction("inc", function increment(x) {
    if (x === undefined || x.kind !== "number") {
      throw EvaluationError.atArg(`inc expects a number${x !== undefined ? `, got ${printString(x)}` : ""}`, { x }, 0);
    }
    return cljNumber(x.value + 1);
  }), "Returns the argument incremented by 1. Throws on non-number arguments.", [["x"]]),
  dec: withDoc(cljNativeFunction("dec", function decrement(x) {
    if (x === undefined || x.kind !== "number") {
      throw EvaluationError.atArg(`dec expects a number${x !== undefined ? `, got ${printString(x)}` : ""}`, { x }, 0);
    }
    return cljNumber(x.value - 1);
  }), "Returns the argument decremented by 1. Throws on non-number arguments.", [["x"]]),
  max: withDoc(cljNativeFunction("max", function maximum(...nums) {
    if (nums.length === 0) {
      throw new EvaluationError("max expects at least one argument", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("max expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.reduce(function findMax(best, arg) {
      return arg.value > best.value ? arg : best;
    });
  }), "Returns the largest of the arguments. Throws on non-number arguments.", [["&", "nums"]]),
  min: withDoc(cljNativeFunction("min", function minimum(...nums) {
    if (nums.length === 0) {
      throw new EvaluationError("min expects at least one argument", {
        args: nums
      });
    }
    const badIdx = nums.findIndex(function isNotNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("min expects all arguments to be numbers", { args: nums }, badIdx);
    }
    return nums.reduce(function findMin(best, arg) {
      return arg.value < best.value ? arg : best;
    });
  }), "Returns the smallest of the arguments. Throws on non-number arguments.", [["&", "nums"]]),
  mod: withDoc(cljNativeFunction("mod", function modulo(n, d) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`mod expects a number as first argument${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    if (d === undefined || d.kind !== "number") {
      throw EvaluationError.atArg(`mod expects a number as second argument${d !== undefined ? `, got ${printString(d)}` : ""}`, { d }, 1);
    }
    if (d.value === 0) {
      const err = new EvaluationError("mod: division by zero", { n, d });
      err.data = { argIndex: 1 };
      throw err;
    }
    const result = n.value % d.value;
    return cljNumber(result < 0 ? result + Math.abs(d.value) : result);
  }), "Returns the remainder of the first argument divided by the second argument. Throws on non-number arguments or division by zero.", [["n", "d"]]),
  "even?": withDoc(cljNativeFunction("even?", function isEven(n) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`even? expects a number${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljBoolean(n.value % 2 === 0);
  }), "Returns true if the argument is an even number, false otherwise.", [["n"]]),
  "odd?": withDoc(cljNativeFunction("odd?", function isOdd(n) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`odd? expects a number${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljBoolean(Math.abs(n.value) % 2 !== 0);
  }), "Returns true if the argument is an odd number, false otherwise.", [["n"]]),
  "pos?": withDoc(cljNativeFunction("pos?", function isPositive(n) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`pos? expects a number${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljBoolean(n.value > 0);
  }), "Returns true if the argument is a positive number, false otherwise.", [["n"]]),
  "neg?": withDoc(cljNativeFunction("neg?", function isNegative(n) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`neg? expects a number${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljBoolean(n.value < 0);
  }), "Returns true if the argument is a negative number, false otherwise.", [["n"]]),
  "zero?": withDoc(cljNativeFunction("zero?", function isZero(n) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`zero? expects a number${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljBoolean(n.value === 0);
  }), "Returns true if the argument is zero, false otherwise.", [["n"]])
};

// src/core/stdlib/atoms.ts
var atomFunctions = {
  atom: withDoc(cljNativeFunction("atom", function atom(value) {
    return cljAtom(value);
  }), "Returns a new atom holding the given value.", [["value"]]),
  deref: withDoc(cljNativeFunction("deref", function deref(value) {
    if (isAtom(value))
      return value.value;
    if (isVolatile(value))
      return value.value;
    if (isReduced(value))
      return value.value;
    throw EvaluationError.atArg(`deref expects an atom, volatile, or reduced value, got ${value.kind}`, { value }, 0);
  }), "Returns the wrapped value from an atom, volatile, or reduced value.", [["value"]]),
  "swap!": withDoc(cljNativeFunctionWithContext("swap!", function swap(ctx, callEnv, atomVal, fn, ...extraArgs) {
    if (!isAtom(atomVal)) {
      throw EvaluationError.atArg(`swap! expects an atom as its first argument, got ${atomVal.kind}`, { atomVal }, 0);
    }
    if (!isAFunction(fn)) {
      throw EvaluationError.atArg(`swap! expects a function as its second argument, got ${fn.kind}`, { fn }, 1);
    }
    const newVal = ctx.applyFunction(fn, [atomVal.value, ...extraArgs], callEnv);
    atomVal.value = newVal;
    return newVal;
  }), "Applies fn to the current value of the atom, replacing the current value with the result. Returns the new value.", [["atomVal", "fn", "&", "extraArgs"]]),
  "reset!": withDoc(cljNativeFunction("reset!", function reset(atomVal, newVal) {
    if (!isAtom(atomVal)) {
      throw EvaluationError.atArg(`reset! expects an atom as its first argument, got ${atomVal.kind}`, { atomVal }, 0);
    }
    atomVal.value = newVal;
    return newVal;
  }), "Sets the value of the atom to newVal and returns the new value.", [["atomVal", "newVal"]]),
  "atom?": withDoc(cljNativeFunction("atom?", function isAtomPredicate(value) {
    return cljBoolean(isAtom(value));
  }), "Returns true if the value is an atom, false otherwise.", [["value"]])
};

// src/core/transformations.ts
function valueToString(value) {
  switch (value.kind) {
    case valueKeywords.string:
      return value.value;
    case valueKeywords.number:
      return value.value.toString();
    case valueKeywords.boolean:
      return value.value ? "true" : "false";
    case valueKeywords.keyword:
      return value.name;
    case valueKeywords.symbol:
      return value.name;
    case valueKeywords.list:
      return `(${value.value.map(valueToString).join(" ")})`;
    case valueKeywords.vector:
      return `[${value.value.map(valueToString).join(" ")}]`;
    case valueKeywords.map:
      return `{${value.entries.map(([key, value2]) => `${valueToString(key)} ${valueToString(value2)}`).join(" ")}}`;
    case valueKeywords.function: {
      if (value.arities.length === 1) {
        const a = value.arities[0];
        const params = a.restParam ? [...a.params, { kind: "symbol", name: "&" }, a.restParam] : a.params;
        return `(fn [${params.map(valueToString).join(" ")}] ${a.body.map(valueToString).join(" ")})`;
      }
      const clauses = value.arities.map((a) => {
        const params = a.restParam ? [...a.params, { kind: "symbol", name: "&" }, a.restParam] : a.params;
        return `([${params.map(valueToString).join(" ")}] ${a.body.map(valueToString).join(" ")})`;
      });
      return `(fn ${clauses.join(" ")})`;
    }
    case valueKeywords.nativeFunction:
      return `(native-fn ${value.name})`;
    case valueKeywords.nil:
      return "nil";
    case valueKeywords.regex: {
      const prefix = value.flags ? `(?${value.flags})` : "";
      return `${prefix}${value.pattern}`;
    }
    default:
      throw new EvaluationError(`unhandled value type: ${value.kind}`, {
        value
      });
  }
}
var toSeq = (collection) => {
  if (isList(collection)) {
    return collection.value;
  }
  if (isVector(collection)) {
    return collection.value;
  }
  if (isMap(collection)) {
    return collection.entries.map(([k, v]) => cljVector([k, v]));
  }
  if (collection.kind === "string") {
    return [...collection.value].map(cljString);
  }
  throw new EvaluationError(`toSeq expects a collection or string, got ${printString(collection)}`, { collection });
};

// src/core/stdlib/collections.ts
var collectionFunctions = {
  list: withDoc(cljNativeFunction("list", function listImpl(...args) {
    if (args.length === 0) {
      return cljList([]);
    }
    return cljList(args);
  }), "Returns a new list containing the given values.", [["&", "args"]]),
  vector: withDoc(cljNativeFunction("vector", function vectorImpl(...args) {
    if (args.length === 0) {
      return cljVector([]);
    }
    return cljVector(args);
  }), "Returns a new vector containing the given values.", [["&", "args"]]),
  "hash-map": withDoc(cljNativeFunction("hash-map", function hashMapImpl(...kvals) {
    if (kvals.length === 0) {
      return cljMap([]);
    }
    if (kvals.length % 2 !== 0) {
      throw new EvaluationError(`hash-map expects an even number of arguments, got ${kvals.length}`, { args: kvals });
    }
    const entries = [];
    for (let i = 0;i < kvals.length; i += 2) {
      const key = kvals[i];
      const value = kvals[i + 1];
      entries.push([key, value]);
    }
    return cljMap(entries);
  }), "Returns a new hash-map containing the given key-value pairs.", [["&", "kvals"]]),
  seq: withDoc(cljNativeFunction("seq", function seqImpl(coll) {
    if (coll.kind === "nil")
      return cljNil();
    if (!isSeqable(coll)) {
      throw EvaluationError.atArg(`seq expects a collection, string, or nil, got ${printString(coll)}`, { collection: coll }, 0);
    }
    const items = toSeq(coll);
    return items.length === 0 ? cljNil() : cljList(items);
  }), "Returns a sequence of the given collection or string. Strings yield a sequence of single-character strings.", [["coll"]]),
  first: withDoc(cljNativeFunction("first", function firstImpl(collection) {
    if (collection.kind === "nil")
      return cljNil();
    if (!isSeqable(collection)) {
      throw EvaluationError.atArg("first expects a collection or string", { collection }, 0);
    }
    const entries = toSeq(collection);
    return entries.length === 0 ? cljNil() : entries[0];
  }), "Returns the first element of the given collection or string.", [["coll"]]),
  rest: withDoc(cljNativeFunction("rest", function restImpl(collection) {
    if (collection.kind === "nil")
      return cljList([]);
    if (!isSeqable(collection)) {
      throw EvaluationError.atArg("rest expects a collection or string", { collection }, 0);
    }
    if (isList(collection)) {
      if (collection.value.length === 0) {
        return collection;
      }
      return cljList(collection.value.slice(1));
    }
    if (isVector(collection)) {
      return cljVector(collection.value.slice(1));
    }
    if (isMap(collection)) {
      if (collection.entries.length === 0) {
        return collection;
      }
      return cljMap(collection.entries.slice(1));
    }
    if (collection.kind === "string") {
      const chars = toSeq(collection);
      return cljList(chars.slice(1));
    }
    throw EvaluationError.atArg(`rest expects a collection or string, got ${printString(collection)}`, { collection }, 0);
  }), "Returns a sequence of the given collection or string excluding the first element.", [["coll"]]),
  conj: withDoc(cljNativeFunction("conj", function conjImpl(collection, ...args) {
    if (!collection) {
      throw new EvaluationError("conj expects a collection as first argument", { collection });
    }
    if (args.length === 0) {
      return collection;
    }
    if (!isCollection(collection)) {
      throw EvaluationError.atArg(`conj expects a collection, got ${printString(collection)}`, { collection }, 0);
    }
    if (isList(collection)) {
      const newItems = [];
      for (let i = args.length - 1;i >= 0; i--) {
        newItems.push(args[i]);
      }
      return cljList([...newItems, ...collection.value]);
    }
    if (isVector(collection)) {
      return cljVector([...collection.value, ...args]);
    }
    if (isMap(collection)) {
      const newEntries = [...collection.entries];
      for (let i = 0;i < args.length; i += 1) {
        const pair = args[i];
        const pairArgIndex = i + 1;
        if (pair.kind !== "vector") {
          throw EvaluationError.atArg(`conj on maps expects each argument to be a vector key-pair for maps, got ${printString(pair)}`, { pair }, pairArgIndex);
        }
        if (pair.value.length !== 2) {
          throw EvaluationError.atArg(`conj on maps expects each argument to be a vector key-pair for maps, got ${printString(pair)}`, { pair }, pairArgIndex);
        }
        const key = pair.value[0];
        const keyIdx = newEntries.findIndex(function findKeyEntry(entry) {
          return isEqual(entry[0], key);
        });
        if (keyIdx === -1) {
          newEntries.push([key, pair.value[1]]);
        } else {
          newEntries[keyIdx] = [key, pair.value[1]];
        }
      }
      return cljMap([...newEntries]);
    }
    throw new EvaluationError(`unhandled collection type, got ${printString(collection)}`, { collection });
  }), "Appends args to the given collection. Lists append in reverse order to the head, vectors append to the tail.", [["collection", "&", "args"]]),
  cons: withDoc(cljNativeFunction("cons", function consImpl(x, xs) {
    if (!isCollection(xs)) {
      throw EvaluationError.atArg(`cons expects a collection as second argument, got ${printString(xs)}`, { xs }, 1);
    }
    if (isMap(xs)) {
      throw EvaluationError.atArg("cons on maps is not supported, use vectors instead", { xs }, 1);
    }
    const wrap = isList(xs) ? cljList : cljVector;
    const newItems = [x, ...xs.value];
    return wrap(newItems);
  }), "Returns a new collection with x prepended to the head of xs.", [["x", "xs"]]),
  assoc: withDoc(cljNativeFunction("assoc", function assocImpl(collection, ...args) {
    if (!collection) {
      throw new EvaluationError("assoc expects a collection as first argument", { collection });
    }
    if (isNil(collection)) {
      collection = cljMap([]);
    }
    if (isList(collection)) {
      throw new EvaluationError("assoc on lists is not supported, use vectors instead", { collection });
    }
    if (!isCollection(collection)) {
      throw EvaluationError.atArg(`assoc expects a collection, got ${printString(collection)}`, { collection }, 0);
    }
    if (args.length < 2) {
      throw new EvaluationError("assoc expects at least two arguments", {
        args
      });
    }
    if (args.length % 2 !== 0) {
      throw new EvaluationError("assoc expects an even number of binding arguments", {
        args
      });
    }
    if (isVector(collection)) {
      const newValues = [...collection.value];
      for (let i = 0;i < args.length; i += 2) {
        const index = args[i];
        if (index.kind !== "number") {
          throw EvaluationError.atArg(`assoc on vectors expects each key argument to be a index (number), got ${printString(index)}`, { index }, i + 1);
        }
        if (index.value > newValues.length) {
          throw EvaluationError.atArg(`assoc index ${index.value} is out of bounds for vector of length ${newValues.length}`, { index, collection }, i + 1);
        }
        newValues[index.value] = args[i + 1];
      }
      return cljVector(newValues);
    }
    if (isMap(collection)) {
      const newEntries = [...collection.entries];
      for (let i = 0;i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        const entryIdx = newEntries.findIndex(function findEntryByKey(entry) {
          return isEqual(entry[0], key);
        });
        if (entryIdx === -1) {
          newEntries.push([key, value]);
        } else {
          newEntries[entryIdx] = [key, value];
        }
      }
      return cljMap(newEntries);
    }
    throw new EvaluationError(`unhandled collection type, got ${printString(collection)}`, { collection });
  }), "Associates the value val with the key k in collection. If collection is a map, returns a new map with the same mappings, otherwise returns a vector with the new value at index k.", [["collection", "&", "kvals"]]),
  dissoc: withDoc(cljNativeFunction("dissoc", function dissocImpl(collection, ...args) {
    if (!collection) {
      throw new EvaluationError("dissoc expects a collection as first argument", { collection });
    }
    if (isList(collection)) {
      throw EvaluationError.atArg("dissoc on lists is not supported, use vectors instead", { collection }, 0);
    }
    if (!isCollection(collection)) {
      throw EvaluationError.atArg(`dissoc expects a collection, got ${printString(collection)}`, { collection }, 0);
    }
    if (isVector(collection)) {
      if (collection.value.length === 0) {
        return collection;
      }
      const newValues = [...collection.value];
      for (let i = 0;i < args.length; i += 1) {
        const index = args[i];
        if (index.kind !== "number") {
          throw EvaluationError.atArg(`dissoc on vectors expects each key argument to be a index (number), got ${printString(index)}`, { index }, i + 1);
        }
        if (index.value >= newValues.length) {
          throw EvaluationError.atArg(`dissoc index ${index.value} is out of bounds for vector of length ${newValues.length}`, { index, collection }, i + 1);
        }
        newValues.splice(index.value, 1);
      }
      return cljVector(newValues);
    }
    if (isMap(collection)) {
      if (collection.entries.length === 0) {
        return collection;
      }
      const newEntries = [...collection.entries];
      for (let i = 0;i < args.length; i += 1) {
        const key = args[i];
        const entryIdx = newEntries.findIndex(function findEntryByKey(entry) {
          return isEqual(entry[0], key);
        });
        if (entryIdx === -1) {
          return collection;
        }
        newEntries.splice(entryIdx, 1);
      }
      return cljMap(newEntries);
    }
    throw new EvaluationError(`unhandled collection type, got ${printString(collection)}`, { collection });
  }), "Dissociates the key k from collection. If collection is a map, returns a new map with the same mappings, otherwise returns a vector with the value at index k removed.", [["collection", "&", "keys"]]),
  get: withDoc(cljNativeFunction("get", function getImpl(target, key, notFound) {
    const defaultValue = notFound ?? cljNil();
    switch (target.kind) {
      case valueKeywords.map: {
        const entries = target.entries;
        for (const [k, v] of entries) {
          if (isEqual(k, key)) {
            return v;
          }
        }
        return defaultValue;
      }
      case valueKeywords.vector: {
        const values = target.value;
        if (key.kind !== "number") {
          throw new EvaluationError("get on vectors expects a 0-based index as parameter", { key });
        }
        if (key.value < 0 || key.value >= values.length) {
          return defaultValue;
        }
        return values[key.value];
      }
      default:
        return defaultValue;
    }
  }), "Returns the value associated with key in target. If target is a map, returns the value associated with key, otherwise returns the value at index key in target. If not-found is provided, it is returned if the key is not found, otherwise nil is returned.", [
    ["target", "key"],
    ["target", "key", "not-found"]
  ]),
  nth: withDoc(cljNativeFunction("nth", function nthImpl(coll, n, notFound) {
    if (coll === undefined || !isList(coll) && !isVector(coll)) {
      throw new EvaluationError(`nth expects a list or vector${coll !== undefined ? `, got ${printString(coll)}` : ""}`, { coll });
    }
    if (n === undefined || n.kind !== "number") {
      throw new EvaluationError(`nth expects a number index${n !== undefined ? `, got ${printString(n)}` : ""}`, { n });
    }
    const index = n.value;
    const items = coll.value;
    if (index < 0 || index >= items.length) {
      if (notFound !== undefined)
        return notFound;
      const err = new EvaluationError(`nth index ${index} is out of bounds for collection of length ${items.length}`, { coll, n });
      err.data = { argIndex: 1 };
      throw err;
    }
    return items[index];
  }), "Returns the nth element of the given collection. If not-found is provided, it is returned if the index is out of bounds, otherwise an error is thrown.", [["coll", "n", "not-found"]]),
  concat: withDoc(cljNativeFunction("concat", function concatImpl(...colls) {
    const result = [];
    for (const coll of colls) {
      if (!isSeqable(coll)) {
        throw new EvaluationError(`concat expects collections or strings, got ${printString(coll)}`, { coll });
      }
      result.push(...toSeq(coll));
    }
    return cljList(result);
  }), "Returns a new sequence that is the concatenation of the given sequences or strings.", [["&", "colls"]]),
  zipmap: withDoc(cljNativeFunction("zipmap", function zipmapImpl(ks, vs) {
    if (ks === undefined || !isSeqable(ks)) {
      throw new EvaluationError(`zipmap expects a collection or string as first argument${ks !== undefined ? `, got ${printString(ks)}` : ""}`, { ks });
    }
    if (vs === undefined || !isSeqable(vs)) {
      throw new EvaluationError(`zipmap expects a collection or string as second argument${vs !== undefined ? `, got ${printString(vs)}` : ""}`, { vs });
    }
    const keys = toSeq(ks);
    const vals = toSeq(vs);
    const len = Math.min(keys.length, vals.length);
    const entries = [];
    for (let i = 0;i < len; i++) {
      entries.push([keys[i], vals[i]]);
    }
    return cljMap(entries);
  }), "Returns a new map with the keys and values of the given collections.", [["ks", "vs"]]),
  last: withDoc(cljNativeFunction("last", function lastImpl(coll) {
    if (coll === undefined || !isList(coll) && !isVector(coll)) {
      throw new EvaluationError(`last expects a list or vector${coll !== undefined ? `, got ${printString(coll)}` : ""}`, { coll });
    }
    const items = coll.value;
    return items.length === 0 ? cljNil() : items[items.length - 1];
  }), "Returns the last element of the given collection.", [["coll"]]),
  reverse: withDoc(cljNativeFunction("reverse", function reverseImpl(coll) {
    if (coll === undefined || !isList(coll) && !isVector(coll)) {
      throw EvaluationError.atArg(`reverse expects a list or vector${coll !== undefined ? `, got ${printString(coll)}` : ""}`, { coll }, 0);
    }
    return cljList([...coll.value].reverse());
  }), "Returns a new sequence with the elements of the given collection in reverse order.", [["coll"]]),
  "empty?": withDoc(cljNativeFunction("empty?", function emptyPredImpl(coll) {
    if (coll === undefined) {
      throw EvaluationError.atArg("empty? expects one argument", {}, 0);
    }
    if (coll.kind === "nil")
      return cljBoolean(true);
    if (!isSeqable(coll)) {
      throw EvaluationError.atArg(`empty? expects a collection, string, or nil, got ${printString(coll)}`, { coll }, 0);
    }
    return cljBoolean(toSeq(coll).length === 0);
  }), "Returns true if coll has no items. Accepts collections, strings, and nil.", [["coll"]]),
  "contains?": withDoc(cljNativeFunction("contains?", function containsPredImpl(coll, key) {
    if (coll === undefined) {
      throw EvaluationError.atArg("contains? expects a collection as first argument", {}, 0);
    }
    if (key === undefined) {
      throw EvaluationError.atArg("contains? expects a key as second argument", {}, 1);
    }
    if (coll.kind === "nil")
      return cljBoolean(false);
    if (isMap(coll)) {
      return cljBoolean(coll.entries.some(function checkKeyMatch([k]) {
        return isEqual(k, key);
      }));
    }
    if (isVector(coll)) {
      if (key.kind !== "number")
        return cljBoolean(false);
      return cljBoolean(key.value >= 0 && key.value < coll.value.length);
    }
    throw EvaluationError.atArg(`contains? expects a map, vector, or nil, got ${printString(coll)}`, { coll }, 0);
  }), "Returns true if key is present in coll. For maps checks key existence (including keys with nil values). For vectors checks index bounds.", [["coll", "key"]]),
  repeat: withDoc(cljNativeFunction("repeat", function repeatImpl(n, x) {
    if (n === undefined || n.kind !== "number") {
      throw EvaluationError.atArg(`repeat expects a number as first argument${n !== undefined ? `, got ${printString(n)}` : ""}`, { n }, 0);
    }
    return cljList(Array(n.value).fill(x));
  }), "Returns a sequence of n copies of x.", [["n", "x"]]),
  range: withDoc(cljNativeFunction("range", function rangeImpl(...args) {
    if (args.length === 0 || args.length > 3) {
      throw new EvaluationError("range expects 1, 2, or 3 arguments: (range n), (range start end), or (range start end step)", { args });
    }
    const badIdx = args.findIndex(function checkIsNumber(a) {
      return a.kind !== "number";
    });
    if (badIdx !== -1) {
      throw EvaluationError.atArg("range expects number arguments", { args }, badIdx);
    }
    let start;
    let end;
    let step;
    if (args.length === 1) {
      start = 0;
      end = args[0].value;
      step = 1;
    } else if (args.length === 2) {
      start = args[0].value;
      end = args[1].value;
      step = 1;
    } else {
      start = args[0].value;
      end = args[1].value;
      step = args[2].value;
    }
    if (step === 0) {
      throw EvaluationError.atArg("range step cannot be zero", { args }, args.length - 1);
    }
    const result = [];
    if (step > 0) {
      for (let i = start;i < end; i += step) {
        result.push(cljNumber(i));
      }
    } else {
      for (let i = start;i > end; i += step) {
        result.push(cljNumber(i));
      }
    }
    return cljList(result);
  }), "Returns a sequence of numbers from start (inclusive) to end (exclusive), incrementing by step. If step is positive, the sequence is generated from start to end, otherwise it is generated from end to start.", [["n"], ["start", "end"], ["start", "end", "step"]]),
  keys: withDoc(cljNativeFunction("keys", function keysImpl(m) {
    if (m === undefined || !isMap(m)) {
      throw EvaluationError.atArg(`keys expects a map${m !== undefined ? `, got ${printString(m)}` : ""}`, { m }, 0);
    }
    return cljVector(m.entries.map(function extractKey([k]) {
      return k;
    }));
  }), "Returns a vector of the keys of the given map.", [["m"]]),
  vals: withDoc(cljNativeFunction("vals", function valsImpl(m) {
    if (m === undefined || !isMap(m)) {
      throw EvaluationError.atArg(`vals expects a map${m !== undefined ? `, got ${printString(m)}` : ""}`, { m }, 0);
    }
    return cljVector(m.entries.map(function extractVal([, v]) {
      return v;
    }));
  }), "Returns a vector of the values of the given map.", [["m"]]),
  count: withDoc(cljNativeFunction("count", function countImpl(countable) {
    if (![
      valueKeywords.list,
      valueKeywords.vector,
      valueKeywords.map,
      valueKeywords.string
    ].includes(countable.kind)) {
      throw EvaluationError.atArg(`count expects a countable value, got ${printString(countable)}`, { countable }, 0);
    }
    switch (countable.kind) {
      case valueKeywords.list:
        return cljNumber(countable.value.length);
      case valueKeywords.vector:
        return cljNumber(countable.value.length);
      case valueKeywords.map:
        return cljNumber(countable.entries.length);
      case valueKeywords.string:
        return cljNumber(countable.value.length);
      default:
        throw new EvaluationError(`count expects a countable value, got ${printString(countable)}`, { countable });
    }
  }), "Returns the number of elements in the given countable value.", [["countable"]])
};

// src/core/stdlib/errors.ts
var errorFunctions = {
  throw: withDoc(cljNativeFunction("throw", function throwImpl(...args) {
    if (args.length !== 1) {
      throw new EvaluationError(`throw requires exactly 1 argument, got ${args.length}`, { args });
    }
    throw new CljThrownSignal(args[0]);
  }), "Throws a value as an exception. The value may be any CljValue; maps are idiomatic.", [["value"]]),
  "ex-info": withDoc(cljNativeFunction("ex-info", function exInfoImpl(...args) {
    if (args.length < 2) {
      throw new EvaluationError(`ex-info requires at least 2 arguments, got ${args.length}`, { args });
    }
    const [msg, data, cause] = args;
    if (msg.kind !== "string") {
      throw new EvaluationError("ex-info: first argument must be a string", { msg });
    }
    const entries = [
      [cljKeyword(":message"), msg],
      [cljKeyword(":data"), data]
    ];
    if (cause !== undefined) {
      entries.push([cljKeyword(":cause"), cause]);
    }
    return cljMap(entries);
  }), "Creates an error map with :message and :data keys. Optionally accepts a :cause.", [["msg", "data"], ["msg", "data", "cause"]]),
  "ex-message": withDoc(cljNativeFunction("ex-message", function exMessageImpl(...args) {
    const [e] = args;
    if (!isMap(e))
      return cljNil();
    const entry = e.entries.find(function findMessageKey([k]) {
      return isKeyword(k) && k.name === ":message";
    });
    return entry ? entry[1] : cljNil();
  }), "Returns the :message of an error map, or nil.", [["e"]]),
  "ex-data": withDoc(cljNativeFunction("ex-data", function exDataImpl(...args) {
    const [e] = args;
    if (!isMap(e))
      return cljNil();
    const entry = e.entries.find(function findDataKey([k]) {
      return isKeyword(k) && k.name === ":data";
    });
    return entry ? entry[1] : cljNil();
  }), "Returns the :data map of an error map, or nil.", [["e"]]),
  "ex-cause": withDoc(cljNativeFunction("ex-cause", function exCauseImpl(...args) {
    const [e] = args;
    if (!isMap(e))
      return cljNil();
    const entry = e.entries.find(function findCauseKey([k]) {
      return isKeyword(k) && k.name === ":cause";
    });
    return entry ? entry[1] : cljNil();
  }), "Returns the :cause of an error map, or nil.", [["e"]])
};

// src/core/stdlib/hof.ts
var hofFunctions = {
  reduce: withDoc(cljNativeFunctionWithContext("reduce", function reduce(ctx, callEnv, fn, ...rest) {
    if (fn === undefined || !isAFunction(fn)) {
      throw EvaluationError.atArg(`reduce expects a function as first argument${fn !== undefined ? `, got ${printString(fn)}` : ""}`, { fn }, 0);
    }
    if (rest.length === 0 || rest.length > 2) {
      throw new EvaluationError("reduce expects 2 or 3 arguments: (reduce f coll) or (reduce f init coll)", { fn });
    }
    const hasInit = rest.length === 2;
    const init = hasInit ? rest[0] : undefined;
    const collection = hasInit ? rest[1] : rest[0];
    if (collection.kind === "nil") {
      if (!hasInit) {
        throw new EvaluationError("reduce called on empty collection with no initial value", { fn });
      }
      return init;
    }
    if (!isSeqable(collection)) {
      throw EvaluationError.atArg(`reduce expects a collection or string, got ${printString(collection)}`, { collection }, rest.length);
    }
    const items = toSeq(collection);
    if (!hasInit) {
      if (items.length === 0) {
        throw new EvaluationError("reduce called on empty collection with no initial value", { fn });
      }
      if (items.length === 1)
        return items[0];
      let acc2 = items[0];
      for (let i = 1;i < items.length; i++) {
        const result = ctx.applyFunction(fn, [acc2, items[i]], callEnv);
        if (isReduced(result))
          return result.value;
        acc2 = result;
      }
      return acc2;
    }
    let acc = init;
    for (const item of items) {
      const result = ctx.applyFunction(fn, [acc, item], callEnv);
      if (isReduced(result))
        return result.value;
      acc = result;
    }
    return acc;
  }), "Reduces a collection to a single value by iteratively applying f. (reduce f coll) or (reduce f init coll).", [
    ["f", "coll"],
    ["f", "val", "coll"]
  ]),
  apply: withDoc(cljNativeFunctionWithContext("apply", (ctx, callEnv, fn, ...rest) => {
    if (fn === undefined || !isCallable(fn)) {
      throw EvaluationError.atArg(`apply expects a callable as first argument${fn !== undefined ? `, got ${printString(fn)}` : ""}`, { fn }, 0);
    }
    if (rest.length === 0) {
      throw new EvaluationError("apply expects at least 2 arguments", {
        fn
      });
    }
    const lastArg = rest[rest.length - 1];
    if (!isNil(lastArg) && !isSeqable(lastArg)) {
      throw EvaluationError.atArg(`apply expects a collection or string as last argument, got ${printString(lastArg)}`, { lastArg }, rest.length);
    }
    const args = [
      ...rest.slice(0, -1),
      ...isNil(lastArg) ? [] : toSeq(lastArg)
    ];
    return ctx.applyCallable(fn, args, callEnv);
  }), "Calls f with the elements of the last argument (a collection) as its arguments, optionally prepended by fixed args.", [
    ["f", "args"],
    ["f", "&", "args"]
  ]),
  partial: withDoc(cljNativeFunction("partial", (fn, ...preArgs) => {
    if (fn === undefined || !isCallable(fn)) {
      throw EvaluationError.atArg(`partial expects a callable as first argument${fn !== undefined ? `, got ${printString(fn)}` : ""}`, { fn }, 0);
    }
    const capturedFn = fn;
    return cljNativeFunctionWithContext("partial", (ctx, callEnv, ...moreArgs) => {
      return ctx.applyCallable(capturedFn, [...preArgs, ...moreArgs], callEnv);
    });
  }), "Returns a function that calls f with pre-applied args prepended to any additional arguments.", [["f", "&", "args"]]),
  comp: withDoc(cljNativeFunction("comp", (...fns) => {
    if (fns.length === 0) {
      return cljNativeFunction("identity", (x) => x);
    }
    const badIdx = fns.findIndex((f) => !isCallable(f));
    if (badIdx !== -1) {
      throw EvaluationError.atArg("comp expects functions or other callable values (keywords, maps)", { fns }, badIdx);
    }
    const capturedFns = fns;
    return cljNativeFunctionWithContext("composed", (ctx, callEnv, ...args) => {
      let result = ctx.applyCallable(capturedFns[capturedFns.length - 1], args, callEnv);
      for (let i = capturedFns.length - 2;i >= 0; i--) {
        result = ctx.applyCallable(capturedFns[i], [result], callEnv);
      }
      return result;
    });
  }), "Returns the composition of fns, applied right-to-left. (comp f g) is equivalent to (fn [x] (f (g x))). Accepts any callable: functions, keywords, and maps.", [[], ["f"], ["f", "g"], ["f", "g", "&", "fns"]]),
  identity: withDoc(cljNativeFunction("identity", (x) => {
    if (x === undefined) {
      throw EvaluationError.atArg("identity expects one argument", {}, 0);
    }
    return x;
  }), "Returns its single argument unchanged.", [["x"]])
};

// src/core/stdlib/meta.ts
var metaFunctions = {
  meta: withDoc(cljNativeFunction("meta", function metaImpl(val) {
    if (val === undefined) {
      throw EvaluationError.atArg("meta expects one argument", {}, 0);
    }
    if (val.kind === "function" || val.kind === "native-function" || val.kind === "var" || val.kind === "list" || val.kind === "vector" || val.kind === "map" || val.kind === "symbol" || val.kind === "atom") {
      return val.meta ?? cljNil();
    }
    return cljNil();
  }), "Returns the metadata map of a value, or nil if the value has no metadata.", [["val"]]),
  "with-meta": withDoc(cljNativeFunction("with-meta", function withMetaImpl(val, m) {
    if (val === undefined) {
      throw EvaluationError.atArg("with-meta expects two arguments", {}, 0);
    }
    if (m === undefined) {
      throw EvaluationError.atArg("with-meta expects two arguments", {}, 1);
    }
    if (m.kind !== "map" && m.kind !== "nil") {
      throw EvaluationError.atArg(`with-meta expects a map as second argument, got ${printString(m)}`, { m }, 1);
    }
    const metaSupported = val.kind === "function" || val.kind === "native-function" || val.kind === "list" || val.kind === "vector" || val.kind === "map" || val.kind === "symbol";
    if (!metaSupported) {
      throw EvaluationError.atArg(`with-meta does not support ${val.kind}, got ${printString(val)}`, { val }, 0);
    }
    const meta = m.kind === "nil" ? undefined : m;
    return { ...val, meta };
  }), "Returns a new value with the metadata map m applied to val.", [["val", "m"]]),
  "alter-meta!": withDoc(cljNativeFunctionWithContext("alter-meta!", function alterMetaImpl(ctx, callEnv, ref, f, ...args) {
    if (ref === undefined) {
      throw EvaluationError.atArg("alter-meta! expects at least two arguments", {}, 0);
    }
    if (f === undefined) {
      throw EvaluationError.atArg("alter-meta! expects at least two arguments", {}, 1);
    }
    if (ref.kind !== "var" && ref.kind !== "atom") {
      throw EvaluationError.atArg(`alter-meta! expects a Var or Atom as first argument, got ${ref.kind}`, {}, 0);
    }
    if (!isAFunction(f)) {
      throw EvaluationError.atArg(`alter-meta! expects a function as second argument, got ${f.kind}`, {}, 1);
    }
    const currentMeta = ref.meta ?? cljNil();
    const newMeta = ctx.applyCallable(f, [currentMeta, ...args], callEnv);
    if (newMeta.kind !== "map" && newMeta.kind !== "nil") {
      throw new EvaluationError(`alter-meta! function must return a map or nil, got ${newMeta.kind}`, {});
    }
    ref.meta = newMeta.kind === "nil" ? undefined : newMeta;
    return newMeta;
  }), "Applies f to ref's current metadata (with optional args), sets the result as the new metadata, and returns it.", [["ref", "f", "&", "args"]])
};

// src/core/evaluator/apply.ts
function applyFunctionWithContext(fn, args, ctx, callEnv) {
  if (fn.kind === "native-function") {
    if (fn.fnWithContext) {
      return fn.fnWithContext(ctx, callEnv, ...args);
    }
    return fn.fn(...args);
  }
  if (fn.kind === "function") {
    const arity = resolveArity(fn.arities, args.length);
    let currentArgs = args;
    while (true) {
      const localEnv = bindParams(arity.params, arity.restParam, currentArgs, fn.env, ctx, callEnv);
      try {
        return ctx.evaluateForms(arity.body, localEnv);
      } catch (e) {
        if (e instanceof RecurSignal) {
          currentArgs = e.args;
          continue;
        }
        throw e;
      }
    }
  }
  throw new EvaluationError(`${fn.kind} is not a callable function`, {
    fn,
    args
  });
}
function applyCallableWithContext(fn, args, ctx, callEnv) {
  if (isAFunction(fn)) {
    return applyFunctionWithContext(fn, args, ctx, callEnv);
  }
  if (isKeyword(fn)) {
    const target = args[0];
    const defaultVal = args.length > 1 ? args[1] : cljNil();
    if (isMap(target)) {
      const entry = target.entries.find(([k]) => isEqual(k, fn));
      return entry ? entry[1] : defaultVal;
    }
    return defaultVal;
  }
  if (isMap(fn)) {
    if (args.length === 0) {
      throw new EvaluationError("Map used as function requires at least one argument", { fn, args });
    }
    const key = args[0];
    const defaultVal = args.length > 1 ? args[1] : cljNil();
    const entry = fn.entries.find(([k]) => isEqual(k, key));
    return entry ? entry[1] : defaultVal;
  }
  throw new EvaluationError(`${printString(fn)} is not a callable value`, {
    fn,
    args
  });
}
function applyMacroWithContext(macro, rawArgs, ctx) {
  const arity = resolveArity(macro.arities, rawArgs.length);
  const localEnv = bindParams(arity.params, arity.restParam, rawArgs, macro.env, ctx, macro.env);
  return ctx.evaluateForms(arity.body, localEnv);
}

// src/core/evaluator/expand.ts
function macroExpandAllWithContext(form, env, ctx) {
  if (isVector(form)) {
    const expanded2 = form.value.map((sub) => macroExpandAllWithContext(sub, env, ctx));
    return expanded2.every((e, i) => e === form.value[i]) ? form : cljVector(expanded2);
  }
  if (isMap(form)) {
    const expanded2 = form.entries.map(([k, v]) => [
      macroExpandAllWithContext(k, env, ctx),
      macroExpandAllWithContext(v, env, ctx)
    ]);
    return expanded2.every(([k, v], i) => k === form.entries[i][0] && v === form.entries[i][1]) ? form : cljMap(expanded2);
  }
  if (!isList(form))
    return form;
  if (form.value.length === 0)
    return form;
  const first = form.value[0];
  if (!isSymbol(first)) {
    const expanded2 = form.value.map((sub) => macroExpandAllWithContext(sub, env, ctx));
    return expanded2.every((e, i) => e === form.value[i]) ? form : cljList(expanded2);
  }
  const name = first.name;
  if (name === "quote" || name === "quasiquote")
    return form;
  const macroOrUnknown = tryLookup(name, env);
  if (macroOrUnknown !== undefined && isMacro(macroOrUnknown)) {
    const expanded2 = ctx.applyMacro(macroOrUnknown, form.value.slice(1));
    return macroExpandAllWithContext(expanded2, env, ctx);
  }
  const expanded = form.value.map((sub) => macroExpandAllWithContext(sub, env, ctx));
  return expanded.every((e, i) => e === form.value[i]) ? form : cljList(expanded);
}

// src/core/evaluator/collections.ts
function evaluateVector(vector, env, ctx) {
  const evaluated = vector.value.map((v) => ctx.evaluate(v, env));
  if (vector.meta)
    return { kind: "vector", value: evaluated, meta: vector.meta };
  return cljVector(evaluated);
}
function evaluateMap(map, env, ctx) {
  let entries = [];
  for (const [key, value] of map.entries) {
    const evaluatedKey = ctx.evaluate(key, env);
    const evaluatedValue = ctx.evaluate(value, env);
    entries.push([evaluatedKey, evaluatedValue]);
  }
  if (map.meta)
    return { kind: "map", entries, meta: map.meta };
  return cljMap(entries);
}

// src/core/evaluator/dispatch.ts
function dispatchMultiMethod(mm, args, ctx, env) {
  const dispatchVal = ctx.applyFunction(mm.dispatchFn, args, env);
  const method = mm.methods.find(({ dispatchVal: dv }) => isEqual(dv, dispatchVal));
  if (method)
    return ctx.applyFunction(method.fn, args, env);
  if (mm.defaultMethod)
    return ctx.applyFunction(mm.defaultMethod, args, env);
  throw new EvaluationError(`No method in multimethod '${mm.name}' for dispatch value ${printString(dispatchVal)}`, { mm, dispatchVal });
}
function evaluateList(list, env, ctx) {
  if (list.value.length === 0) {
    throw new EvaluationError("Unexpected empty list", { list, env });
  }
  const first = list.value[0];
  if (isSpecialForm(first)) {
    return evaluateSpecialForm(first.name, list, env, ctx);
  }
  const evaledFirst = ctx.evaluate(first, env);
  if (isMultiMethod(evaledFirst)) {
    const args2 = list.value.slice(1).map((v) => ctx.evaluate(v, env));
    return dispatchMultiMethod(evaledFirst, args2, ctx, env);
  }
  if (!isCallable(evaledFirst)) {
    const name = isSymbol(first) ? first.name : printString(first);
    throw new EvaluationError(`${name} is not callable`, { list, env });
  }
  const args = list.value.slice(1).map((v) => ctx.evaluate(v, env));
  try {
    return ctx.applyCallable(evaledFirst, args, env);
  } catch (e) {
    if (e instanceof EvaluationError && e.data?.argIndex !== undefined && !e.pos) {
      const argForm = list.value[e.data.argIndex + 1];
      if (argForm) {
        const pos = getPos(argForm);
        if (pos)
          e.pos = pos;
      }
    }
    throw e;
  }
}

// src/core/evaluator/evaluate.ts
function evaluateWithContext(expr, env, ctx) {
  try {
    switch (expr.kind) {
      case valueKeywords.number:
      case valueKeywords.string:
      case valueKeywords.keyword:
      case valueKeywords.nil:
      case valueKeywords.function:
      case valueKeywords.multiMethod:
      case valueKeywords.boolean:
      case valueKeywords.regex:
        return expr;
      case valueKeywords.symbol: {
        const slashIdx = expr.name.indexOf("/");
        if (slashIdx > 0 && slashIdx < expr.name.length - 1) {
          const alias = expr.name.slice(0, slashIdx);
          const sym = expr.name.slice(slashIdx + 1);
          const nsEnv = getNamespaceEnv(env);
          const aliasCljNs = nsEnv.ns?.aliases.get(alias);
          if (aliasCljNs) {
            const v = aliasCljNs.vars.get(sym);
            if (v === undefined) {
              throw new EvaluationError(`Symbol ${expr.name} not found`, {
                symbol: expr.name,
                env
              });
            }
            return v.value;
          }
          const targetEnv = getRootEnv(env).resolveNs?.(alias) ?? null;
          if (!targetEnv) {
            throw new EvaluationError(`No such namespace or alias: ${alias}`, {
              symbol: expr.name,
              env
            });
          }
          return lookup(sym, targetEnv);
        }
        return lookup(expr.name, env);
      }
      case valueKeywords.vector:
        return evaluateVector(expr, env, ctx);
      case valueKeywords.map:
        return evaluateMap(expr, env, ctx);
      case valueKeywords.list:
        return evaluateList(expr, env, ctx);
      default:
        throw new EvaluationError("Unexpected value", { expr, env });
    }
  } catch (e) {
    if (e instanceof EvaluationError && !e.pos) {
      const p = getPos(expr);
      if (p)
        e.pos = p;
    }
    throw e;
  }
}
function evaluateFormsWithContext(forms, env, ctx) {
  let result = cljNil();
  for (const form of forms) {
    result = ctx.evaluate(form, env);
  }
  return result;
}

// src/core/evaluator/index.ts
function createEvaluationContext() {
  const ctx = {
    evaluate: (expr, env) => evaluateWithContext(expr, env, ctx),
    evaluateForms: (forms, env) => evaluateFormsWithContext(forms, env, ctx),
    applyFunction: (fn, args, callEnv) => applyFunctionWithContext(fn, args, ctx, callEnv),
    applyCallable: (fn, args, callEnv) => applyCallableWithContext(fn, args, ctx, callEnv),
    applyMacro: (macro, rawArgs) => applyMacroWithContext(macro, rawArgs, ctx),
    expandAll: (form, env) => macroExpandAllWithContext(form, env, ctx)
  };
  return ctx;
}
function applyFunction(fn, args, callEnv = makeEnv()) {
  return createEvaluationContext().applyFunction(fn, args, callEnv);
}

// src/core/stdlib/predicates.ts
var predicateFunctions = {
  "nil?": withDoc(cljNativeFunction("nil?", function nilPredImpl(arg) {
    return cljBoolean(arg.kind === "nil");
  }), "Returns true if the value is nil, false otherwise.", [["arg"]]),
  "true?": withDoc(cljNativeFunction("true?", function truePredImpl(arg) {
    if (arg.kind !== "boolean") {
      return cljBoolean(false);
    }
    return cljBoolean(arg.value === true);
  }), "Returns true if the value is a boolean and true, false otherwise.", [["arg"]]),
  "false?": withDoc(cljNativeFunction("false?", function falsePredImpl(arg) {
    if (arg.kind !== "boolean") {
      return cljBoolean(false);
    }
    return cljBoolean(arg.value === false);
  }), "Returns true if the value is a boolean and false, false otherwise.", [["arg"]]),
  "truthy?": withDoc(cljNativeFunction("truthy?", function truthyPredImpl(arg) {
    return cljBoolean(isTruthy(arg));
  }), "Returns true if the value is not nil or false, false otherwise.", [["arg"]]),
  "falsy?": withDoc(cljNativeFunction("falsy?", function falsyPredImpl(arg) {
    return cljBoolean(isFalsy(arg));
  }), "Returns true if the value is nil or false, false otherwise.", [["arg"]]),
  "not=": withDoc(cljNativeFunction("not=", function notEqualImpl(...vals) {
    if (vals.length < 2) {
      throw new EvaluationError("not= expects at least two arguments", {
        args: vals
      });
    }
    for (let i = 1;i < vals.length; i++) {
      if (!isEqual(vals[i], vals[i - 1])) {
        return cljBoolean(true);
      }
    }
    return cljBoolean(false);
  }), "Returns true if any two adjacent arguments are not equal, false otherwise.", [["&", "vals"]]),
  "number?": withDoc(cljNativeFunction("number?", function numberPredImpl(x) {
    return cljBoolean(x !== undefined && x.kind === "number");
  }), "Returns true if the value is a number, false otherwise.", [["x"]]),
  "string?": withDoc(cljNativeFunction("string?", function stringPredImpl(x) {
    return cljBoolean(x !== undefined && x.kind === "string");
  }), "Returns true if the value is a string, false otherwise.", [["x"]]),
  "boolean?": withDoc(cljNativeFunction("boolean?", function booleanPredImpl(x) {
    return cljBoolean(x !== undefined && x.kind === "boolean");
  }), "Returns true if the value is a boolean, false otherwise.", [["x"]]),
  "vector?": withDoc(cljNativeFunction("vector?", function vectorPredImpl(x) {
    return cljBoolean(x !== undefined && isVector(x));
  }), "Returns true if the value is a vector, false otherwise.", [["x"]]),
  "list?": withDoc(cljNativeFunction("list?", function listPredImpl(x) {
    return cljBoolean(x !== undefined && isList(x));
  }), "Returns true if the value is a list, false otherwise.", [["x"]]),
  "map?": withDoc(cljNativeFunction("map?", function mapPredImpl(x) {
    return cljBoolean(x !== undefined && isMap(x));
  }), "Returns true if the value is a map, false otherwise.", [["x"]]),
  "keyword?": withDoc(cljNativeFunction("keyword?", function keywordPredImpl(x) {
    return cljBoolean(x !== undefined && isKeyword(x));
  }), "Returns true if the value is a keyword, false otherwise.", [["x"]]),
  "qualified-keyword?": withDoc(cljNativeFunction("qualified-keyword?", function qualifiedKeywordPredImpl(x) {
    return cljBoolean(x !== undefined && isKeyword(x) && x.name.includes("/"));
  }), "Returns true if the value is a qualified keyword, false otherwise.", [["x"]]),
  "symbol?": withDoc(cljNativeFunction("symbol?", function symbolPredImpl(x) {
    return cljBoolean(x !== undefined && isSymbol(x));
  }), "Returns true if the value is a symbol, false otherwise.", [["x"]]),
  "qualified-symbol?": withDoc(cljNativeFunction("qualified-symbol?", function qualifiedSymbolPredImpl(x) {
    return cljBoolean(x !== undefined && isSymbol(x) && x.name.includes("/"));
  }), "Returns true if the value is a qualified symbol, false otherwise.", [["x"]]),
  "fn?": withDoc(cljNativeFunction("fn?", function fnPredImpl(x) {
    return cljBoolean(x !== undefined && isAFunction(x));
  }), "Returns true if the value is a function, false otherwise.", [["x"]]),
  "coll?": withDoc(cljNativeFunction("coll?", function collPredImpl(x) {
    return cljBoolean(x !== undefined && isCollection(x));
  }), "Returns true if the value is a collection, false otherwise.", [["x"]]),
  some: withDoc(cljNativeFunction("some", function someImpl(pred, coll) {
    if (pred === undefined || !isAFunction(pred)) {
      throw EvaluationError.atArg(`some expects a function as first argument${pred !== undefined ? `, got ${printString(pred)}` : ""}`, { pred }, 0);
    }
    if (coll === undefined) {
      return cljNil();
    }
    if (!isSeqable(coll)) {
      throw EvaluationError.atArg(`some expects a collection or string as second argument, got ${printString(coll)}`, { coll }, 1);
    }
    for (const item of toSeq(coll)) {
      const result = applyFunction(pred, [item]);
      if (isTruthy(result)) {
        return result;
      }
    }
    return cljNil();
  }), "Returns the first truthy result of applying pred to each item in coll, or nil if no item satisfies pred.", [["pred", "coll"]]),
  "every?": withDoc(cljNativeFunction("every?", function everyPredImpl(pred, coll) {
    if (pred === undefined || !isAFunction(pred)) {
      throw EvaluationError.atArg(`every? expects a function as first argument${pred !== undefined ? `, got ${printString(pred)}` : ""}`, { pred }, 0);
    }
    if (coll === undefined || !isSeqable(coll)) {
      throw EvaluationError.atArg(`every? expects a collection or string as second argument${coll !== undefined ? `, got ${printString(coll)}` : ""}`, { coll }, 1);
    }
    for (const item of toSeq(coll)) {
      if (isFalsy(applyFunction(pred, [item]))) {
        return cljBoolean(false);
      }
    }
    return cljBoolean(true);
  }), "Returns true if all items in coll satisfy pred, false otherwise.", [["pred", "coll"]])
};

// src/core/stdlib/regex.ts
function extractInlineFlags(raw) {
  let remaining = raw;
  let flags = "";
  const flagGroupRe = /^\(\?([imsx]+)\)/;
  let m;
  while ((m = flagGroupRe.exec(remaining)) !== null) {
    for (const f of m[1]) {
      if (f === "x") {
        throw new EvaluationError("Regex flag (?x) (verbose mode) has no JavaScript equivalent and is not supported", {});
      }
      if (!flags.includes(f))
        flags += f;
    }
    remaining = remaining.slice(m[0].length);
  }
  return { pattern: remaining, flags };
}
function assertRegex(val, fnName) {
  if (!isRegex(val)) {
    throw new EvaluationError(`${fnName} expects a regex as first argument, got ${printString(val)}`, { val });
  }
  return val;
}
function assertStringArg(val, fnName) {
  if (val.kind !== "string") {
    throw new EvaluationError(`${fnName} expects a string as second argument, got ${printString(val)}`, { val });
  }
  return val.value;
}
function matchToClj(match) {
  if (match.length === 1)
    return cljString(match[0]);
  return cljVector(match.map(function mapMatchToClj(m) {
    return m == null ? cljNil() : cljString(m);
  }));
}
var regexFunctions = {
  "regexp?": withDoc(cljNativeFunction("regexp?", function regexpPredImpl(x) {
    return cljBoolean(x !== undefined && isRegex(x));
  }), "Returns true if x is a regular expression pattern.", [["x"]]),
  "re-pattern": withDoc(cljNativeFunction("re-pattern", function rePatternImpl(s) {
    if (s === undefined || s.kind !== "string") {
      throw new EvaluationError(`re-pattern expects a string argument${s !== undefined ? `, got ${printString(s)}` : ""}`, { s });
    }
    const { pattern, flags } = extractInlineFlags(s.value);
    return cljRegex(pattern, flags);
  }), `Returns an instance of java.util.regex.Pattern, for use, e.g. in re-matcher.
  (re-pattern "\\\\d+") produces the same pattern as #"\\d+".`, [["s"]]),
  "re-find": withDoc(cljNativeFunction("re-find", function reFindImpl(reVal, sVal) {
    const re = assertRegex(reVal, "re-find");
    const s = assertStringArg(sVal, "re-find");
    const jsRe = new RegExp(re.pattern, re.flags);
    const match = jsRe.exec(s);
    if (!match)
      return cljNil();
    return matchToClj(match);
  }), `Returns the next regex match, if any, of string to pattern, using
  java.util.regex.Matcher.find(). Returns the match or nil. When there
  are groups, returns a vector of the whole match and groups (nil for
  unmatched optional groups).`, [["re", "s"]]),
  "re-matches": withDoc(cljNativeFunction("re-matches", function reMatchesImpl(reVal, sVal) {
    const re = assertRegex(reVal, "re-matches");
    const s = assertStringArg(sVal, "re-matches");
    const jsRe = new RegExp(re.pattern, re.flags);
    const match = jsRe.exec(s);
    if (!match || match.index !== 0 || match[0].length !== s.length) {
      return cljNil();
    }
    return matchToClj(match);
  }), `Returns the match, if any, of string to pattern, using
  java.util.regex.Matcher.matches(). The entire string must match.
  Returns the match or nil. When there are groups, returns a vector
  of the whole match and groups (nil for unmatched optional groups).`, [["re", "s"]]),
  "re-seq": withDoc(cljNativeFunction("re-seq", function reSeqImpl(reVal, sVal) {
    const re = assertRegex(reVal, "re-seq");
    const s = assertStringArg(sVal, "re-seq");
    const jsRe = new RegExp(re.pattern, re.flags + "g");
    const results = [];
    let match;
    while ((match = jsRe.exec(s)) !== null) {
      if (match[0].length === 0) {
        jsRe.lastIndex++;
        continue;
      }
      results.push(matchToClj(match));
    }
    if (results.length === 0)
      return cljNil();
    return { kind: "list", value: results };
  }), `Returns a lazy sequence of successive matches of pattern in string,
  using java.util.regex.Matcher.find(), each such match processed with
  re-groups.`, [["re", "s"]]),
  "str-split*": withDoc(cljNativeFunction("str-split*", function strSplitImpl(sVal, sepVal, limitVal) {
    if (sVal === undefined || sVal.kind !== "string") {
      throw new EvaluationError(`str-split* expects a string as first argument${sVal !== undefined ? `, got ${printString(sVal)}` : ""}`, { sVal });
    }
    const s = sVal.value;
    const hasLimit = limitVal !== undefined && limitVal.kind !== "nil";
    const limit = hasLimit && limitVal.kind === "number" ? limitVal.value : undefined;
    let jsPattern;
    let jsFlags;
    if (sepVal.kind !== "regex") {
      throw new EvaluationError(`str-split* expects a regex pattern as second argument, got ${printString(sepVal)}`, { sepVal });
    }
    if (sepVal.pattern === "") {
      const chars = [...s];
      if (limit === undefined || limit >= chars.length) {
        return cljVector(chars.map(cljString));
      }
      const parts = [...chars.slice(0, limit - 1), chars.slice(limit - 1).join("")];
      return cljVector(parts.map(function mapPartToString(p) {
        return cljString(p);
      }));
    }
    jsPattern = sepVal.pattern;
    jsFlags = sepVal.flags;
    const re = new RegExp(jsPattern, jsFlags + "g");
    const rawParts = splitWithRegex(s, re, limit);
    return cljVector(rawParts.map(function mapRawPartToString(p) {
      return cljString(p);
    }));
  }), `Internal helper for clojure.string/split. Splits string s by a regex or
  string separator. Optional limit keeps all parts when provided.`, [["s", "sep"], ["s", "sep", "limit"]])
};
function splitWithRegex(s, re, limit) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let count = 0;
  while ((match = re.exec(s)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (limit !== undefined && count >= limit - 1)
      break;
    parts.push(s.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
    count++;
  }
  parts.push(s.slice(lastIndex));
  if (limit === undefined) {
    while (parts.length > 0 && parts[parts.length - 1] === "") {
      parts.pop();
    }
  }
  return parts;
}

// src/core/stdlib/strings.ts
function assertStr(val, fnName) {
  if (val === undefined || val.kind !== "string") {
    throw new EvaluationError(`${fnName} expects a string as first argument${val !== undefined ? `, got ${printString(val)}` : ""}`, { val });
  }
  return val.value;
}
function assertStrArg(val, pos, fnName) {
  if (val === undefined || val.kind !== "string") {
    throw new EvaluationError(`${fnName} expects a string as ${pos} argument${val !== undefined ? `, got ${printString(val)}` : ""}`, { val });
  }
  return val.value;
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeDollarInReplacement(s) {
  return s.replace(/\$/g, "$$$$");
}
function buildMatchValue(whole, args) {
  let offsetIdx = -1;
  for (let i = args.length - 1;i >= 0; i--) {
    if (typeof args[i] === "number") {
      offsetIdx = i;
      break;
    }
  }
  const groups = offsetIdx > 0 ? args.slice(0, offsetIdx) : [];
  if (groups.length === 0)
    return cljString(whole);
  return cljVector([
    cljString(whole),
    ...groups.map(function mapGroupToClj(g) {
      return g == null ? cljNil() : cljString(String(g));
    })
  ]);
}
function doReplace(ctx, callEnv, fnName, sVal, matchVal, replVal, global) {
  const s = assertStr(sVal, fnName);
  if (matchVal === undefined || replVal === undefined) {
    throw new EvaluationError(`${fnName} expects 3 arguments`, {});
  }
  if (matchVal.kind === "string") {
    if (replVal.kind !== "string") {
      throw new EvaluationError(`${fnName}: when match is a string, replacement must also be a string, got ${printString(replVal)}`, { replVal });
    }
    const re = new RegExp(escapeRegex(matchVal.value), global ? "g" : "");
    return cljString(s.replace(re, escapeDollarInReplacement(replVal.value)));
  }
  if (matchVal.kind === "regex") {
    const re = matchVal;
    const flags = global ? re.flags + "g" : re.flags;
    const jsRe = new RegExp(re.pattern, flags);
    if (replVal.kind === "string") {
      return cljString(s.replace(jsRe, replVal.value));
    }
    if (isAFunction(replVal)) {
      const fn = replVal;
      const result = s.replace(jsRe, function replaceCallback(whole, ...args) {
        const matchClj = buildMatchValue(whole, args);
        const replResult = ctx.applyFunction(fn, [matchClj], callEnv);
        return valueToString(replResult);
      });
      return cljString(result);
    }
    throw new EvaluationError(`${fnName}: replacement must be a string or function, got ${printString(replVal)}`, { replVal });
  }
  throw new EvaluationError(`${fnName}: match must be a string or regex, got ${printString(matchVal)}`, { matchVal });
}
var stringFunctions = {
  "str-upper-case*": withDoc(cljNativeFunction("str-upper-case*", function strUpperCaseImpl(sVal) {
    return cljString(assertStr(sVal, "str-upper-case*").toUpperCase());
  }), "Internal helper. Converts s to upper-case.", [["s"]]),
  "str-lower-case*": withDoc(cljNativeFunction("str-lower-case*", function strLowerCaseImpl(sVal) {
    return cljString(assertStr(sVal, "str-lower-case*").toLowerCase());
  }), "Internal helper. Converts s to lower-case.", [["s"]]),
  "str-trim*": withDoc(cljNativeFunction("str-trim*", function strTrimImpl(sVal) {
    return cljString(assertStr(sVal, "str-trim*").trim());
  }), "Internal helper. Removes whitespace from both ends of s.", [["s"]]),
  "str-triml*": withDoc(cljNativeFunction("str-triml*", function strTrimlImpl(sVal) {
    return cljString(assertStr(sVal, "str-triml*").trimStart());
  }), "Internal helper. Removes whitespace from the left of s.", [["s"]]),
  "str-trimr*": withDoc(cljNativeFunction("str-trimr*", function strTrimrImpl(sVal) {
    return cljString(assertStr(sVal, "str-trimr*").trimEnd());
  }), "Internal helper. Removes whitespace from the right of s.", [["s"]]),
  "str-reverse*": withDoc(cljNativeFunction("str-reverse*", function strReverseImpl(sVal) {
    return cljString([...assertStr(sVal, "str-reverse*")].reverse().join(""));
  }), "Internal helper. Returns s with its characters reversed (Unicode-safe).", [["s"]]),
  "str-starts-with*": withDoc(cljNativeFunction("str-starts-with*", function strStartsWithImpl(sVal, substrVal) {
    const s = assertStr(sVal, "str-starts-with*");
    const substr = assertStrArg(substrVal, "second", "str-starts-with*");
    return cljBoolean(s.startsWith(substr));
  }), "Internal helper. Returns true if s starts with substr.", [["s", "substr"]]),
  "str-ends-with*": withDoc(cljNativeFunction("str-ends-with*", function strEndsWithImpl(sVal, substrVal) {
    const s = assertStr(sVal, "str-ends-with*");
    const substr = assertStrArg(substrVal, "second", "str-ends-with*");
    return cljBoolean(s.endsWith(substr));
  }), "Internal helper. Returns true if s ends with substr.", [["s", "substr"]]),
  "str-includes*": withDoc(cljNativeFunction("str-includes*", function strIncludesImpl(sVal, substrVal) {
    const s = assertStr(sVal, "str-includes*");
    const substr = assertStrArg(substrVal, "second", "str-includes*");
    return cljBoolean(s.includes(substr));
  }), "Internal helper. Returns true if s contains substr.", [["s", "substr"]]),
  "str-index-of*": withDoc(cljNativeFunction("str-index-of*", function strIndexOfImpl(sVal, valVal, fromVal) {
    const s = assertStr(sVal, "str-index-of*");
    const needle = assertStrArg(valVal, "second", "str-index-of*");
    let idx;
    if (fromVal !== undefined && fromVal.kind !== "nil") {
      if (fromVal.kind !== "number") {
        throw new EvaluationError(`str-index-of* expects a number as third argument, got ${printString(fromVal)}`, { fromVal });
      }
      idx = s.indexOf(needle, fromVal.value);
    } else {
      idx = s.indexOf(needle);
    }
    return idx === -1 ? cljNil() : cljNumber(idx);
  }), "Internal helper. Returns index of value in s, or nil if not found.", [["s", "value"], ["s", "value", "from-index"]]),
  "str-last-index-of*": withDoc(cljNativeFunction("str-last-index-of*", function strLastIndexOfImpl(sVal, valVal, fromVal) {
    const s = assertStr(sVal, "str-last-index-of*");
    const needle = assertStrArg(valVal, "second", "str-last-index-of*");
    let idx;
    if (fromVal !== undefined && fromVal.kind !== "nil") {
      if (fromVal.kind !== "number") {
        throw new EvaluationError(`str-last-index-of* expects a number as third argument, got ${printString(fromVal)}`, { fromVal });
      }
      idx = s.lastIndexOf(needle, fromVal.value);
    } else {
      idx = s.lastIndexOf(needle);
    }
    return idx === -1 ? cljNil() : cljNumber(idx);
  }), "Internal helper. Returns last index of value in s, or nil if not found.", [["s", "value"], ["s", "value", "from-index"]]),
  "str-replace*": withDoc(cljNativeFunctionWithContext("str-replace*", function strReplaceImpl(ctx, callEnv, sVal, matchVal, replVal) {
    return doReplace(ctx, callEnv, "str-replace*", sVal, matchVal, replVal, true);
  }), "Internal helper. Replaces all occurrences of match with replacement in s.", [["s", "match", "replacement"]]),
  "str-replace-first*": withDoc(cljNativeFunctionWithContext("str-replace-first*", function strReplaceFirstImpl(ctx, callEnv, sVal, matchVal, replVal) {
    return doReplace(ctx, callEnv, "str-replace-first*", sVal, matchVal, replVal, false);
  }), "Internal helper. Replaces the first occurrence of match with replacement in s.", [["s", "match", "replacement"]])
};

// src/core/stdlib/transducers.ts
var transducerFunctions = {
  reduced: withDoc(cljNativeFunction("reduced", function reducedImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("reduced expects one argument", {});
    }
    return cljReduced(value);
  }), "Returns a reduced value, indicating termination of the reduction process.", [["value"]]),
  "reduced?": withDoc(cljNativeFunction("reduced?", function isReducedImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("reduced? expects one argument", {});
    }
    return cljBoolean(isReduced(value));
  }), "Returns true if the given value is a reduced value, false otherwise.", [["value"]]),
  unreduced: withDoc(cljNativeFunction("unreduced", function unreducedImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("unreduced expects one argument", {});
    }
    return isReduced(value) ? value.value : value;
  }), "Returns the unreduced value of the given value. If the value is not a reduced value, it is returned unchanged.", [["value"]]),
  "ensure-reduced": withDoc(cljNativeFunction("ensure-reduced", function ensureReducedImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("ensure-reduced expects one argument", {});
    }
    return isReduced(value) ? value : cljReduced(value);
  }), "Returns the given value if it is a reduced value, otherwise returns a reduced value with the given value as its value.", [["value"]]),
  "volatile!": withDoc(cljNativeFunction("volatile!", function volatileImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("volatile! expects one argument", {});
    }
    return cljVolatile(value);
  }), "Returns a volatile value with the given value as its value.", [["value"]]),
  "volatile?": withDoc(cljNativeFunction("volatile?", function isVolatileImpl(value) {
    if (value === undefined) {
      throw new EvaluationError("volatile? expects one argument", {});
    }
    return cljBoolean(isVolatile(value));
  }), "Returns true if the given value is a volatile value, false otherwise.", [["value"]]),
  "vreset!": withDoc(cljNativeFunction("vreset!", function vresetImpl(vol, newVal) {
    if (!isVolatile(vol)) {
      throw new EvaluationError(`vreset! expects a volatile as its first argument, got ${printString(vol)}`, { vol });
    }
    if (newVal === undefined) {
      throw new EvaluationError("vreset! expects two arguments", { vol });
    }
    vol.value = newVal;
    return newVal;
  }), "Resets the value of the given volatile to the given new value and returns the new value.", [["vol", "newVal"]]),
  "vswap!": withDoc(cljNativeFunctionWithContext("vswap!", function vswapImpl(ctx, callEnv, vol, fn, ...extraArgs) {
    if (!isVolatile(vol)) {
      throw new EvaluationError(`vswap! expects a volatile as its first argument, got ${printString(vol)}`, { vol });
    }
    if (!isAFunction(fn)) {
      throw new EvaluationError(`vswap! expects a function as its second argument, got ${printString(fn)}`, { fn });
    }
    const newVal = ctx.applyFunction(fn, [vol.value, ...extraArgs], callEnv);
    vol.value = newVal;
    return newVal;
  }), "Applies fn to the current value of the volatile, replacing the current value with the result. Returns the new value.", [
    ["vol", "fn"],
    ["vol", "fn", "&", "extraArgs"]
  ]),
  transduce: withDoc(cljNativeFunctionWithContext("transduce", function transduceImpl(ctx, callEnv, xform, f, init, coll) {
    if (!isAFunction(xform)) {
      throw new EvaluationError(`transduce expects a transducer (function) as first argument, got ${printString(xform)}`, { xf: xform });
    }
    if (!isAFunction(f)) {
      throw new EvaluationError(`transduce expects a reducing function as second argument, got ${printString(f)}`, { f });
    }
    if (init === undefined) {
      throw new EvaluationError("transduce expects 3 or 4 arguments: (transduce xf f coll) or (transduce xf f init coll)", {});
    }
    let actualInit;
    let actualColl;
    if (coll === undefined) {
      actualColl = init;
      actualInit = ctx.applyFunction(f, [], callEnv);
    } else {
      actualInit = init;
      actualColl = coll;
    }
    const rf = ctx.applyFunction(xform, [f], callEnv);
    if (isNil(actualColl)) {
      return ctx.applyFunction(rf, [actualInit], callEnv);
    }
    if (!isSeqable(actualColl)) {
      throw new EvaluationError(`transduce expects a collection or string as ${coll === undefined ? "third" : "fourth"} argument, got ${printString(actualColl)}`, { coll: actualColl });
    }
    const items = toSeq(actualColl);
    let acc = actualInit;
    for (const item of items) {
      const result = ctx.applyFunction(rf, [acc, item], callEnv);
      if (isReduced(result)) {
        acc = result.value;
        break;
      }
      acc = result;
    }
    return ctx.applyFunction(rf, [acc], callEnv);
  }), joinLines([
    "reduce with a transformation of f (xf). If init is not",
    "supplied, (f) will be called to produce it. f should be a reducing",
    "step function that accepts both 1 and 2 arguments, if it accepts",
    "only 2 you can add the arity-1 with 'completing'. Returns the result",
    "of applying (the transformed) xf to init and the first item in coll,",
    "then applying xf to that result and the 2nd item, etc. If coll",
    "contains no items, returns init and f is not called. Note that",
    "certain transforms may inject or skip items."
  ]), [
    ["xform", "f", "coll"],
    ["xform", "f", "init", "coll"]
  ])
};

// src/core/stdlib/utils.ts
var utilFunctions = {
  str: withDoc(cljNativeFunction("str", function strImpl(...args) {
    return cljString(args.map(valueToString).join(""));
  }), "Returns a concatenated string representation of the given values.", [["&", "args"]]),
  subs: withDoc(cljNativeFunction("subs", function subsImpl(s, start, end) {
    if (s === undefined || s.kind !== "string") {
      throw EvaluationError.atArg(`subs expects a string as first argument${s !== undefined ? `, got ${printString(s)}` : ""}`, { s }, 0);
    }
    if (start === undefined || start.kind !== "number") {
      throw EvaluationError.atArg(`subs expects a number as second argument${start !== undefined ? `, got ${printString(start)}` : ""}`, { start }, 1);
    }
    if (end !== undefined && end.kind !== "number") {
      throw EvaluationError.atArg(`subs expects a number as optional third argument${end !== undefined ? `, got ${printString(end)}` : ""}`, { end }, 2);
    }
    const from = start.value;
    const to = end?.value;
    return cljString(to === undefined ? s.value.slice(from) : s.value.slice(from, to));
  }), "Returns the substring of s beginning at start, and optionally ending before end.", [
    ["s", "start"],
    ["s", "start", "end"]
  ]),
  type: withDoc(cljNativeFunction("type", function typeImpl(x) {
    if (x === undefined) {
      throw new EvaluationError("type expects an argument", { x });
    }
    const kindToKeyword = {
      number: ":number",
      string: ":string",
      boolean: ":boolean",
      nil: ":nil",
      keyword: ":keyword",
      symbol: ":symbol",
      list: ":list",
      vector: ":vector",
      map: ":map",
      function: ":function",
      regex: ":regex",
      var: ":var",
      "native-function": ":function"
    };
    const name = kindToKeyword[x.kind];
    if (!name) {
      throw new EvaluationError(`type: unhandled kind ${x.kind}`, { x });
    }
    return cljKeyword(name);
  }), "Returns a keyword representing the type of the given value.", [["x"]]),
  gensym: withDoc(cljNativeFunction("gensym", function gensymImpl(...args) {
    if (args.length > 1) {
      throw new EvaluationError("gensym takes 0 or 1 arguments", { args });
    }
    const prefix = args[0];
    if (prefix !== undefined && prefix.kind !== "string") {
      throw EvaluationError.atArg(`gensym prefix must be a string${prefix !== undefined ? `, got ${printString(prefix)}` : ""}`, { prefix }, 0);
    }
    const p = prefix?.kind === "string" ? prefix.value : "G";
    return cljSymbol(makeGensym(p));
  }), 'Returns a unique symbol with the given prefix. Defaults to "G" if no prefix is provided.', [[], ["prefix"]]),
  eval: withDoc(cljNativeFunctionWithContext("eval", function evalImpl(ctx, callEnv, form) {
    if (form === undefined) {
      throw new EvaluationError("eval expects a form as argument", {
        form
      });
    }
    const expanded = ctx.expandAll(form, callEnv);
    return ctx.evaluate(expanded, callEnv);
  }), "Evaluates the given form in the global environment and returns the result.", [["form"]]),
  "macroexpand-1": withDoc(cljNativeFunctionWithContext("macroexpand-1", function macroexpand1Impl(ctx, callEnv, form) {
    if (!isList(form) || form.value.length === 0)
      return form;
    const head = form.value[0];
    if (!isSymbol(head))
      return form;
    const macroValue = tryLookup(head.name, callEnv);
    if (macroValue === undefined)
      return form;
    if (!isMacro(macroValue))
      return form;
    return ctx.applyMacro(macroValue, form.value.slice(1));
  }), "If the head of the form is a macro, expands it and returns the resulting forms. Otherwise, returns the form unchanged.", [["form"]]),
  macroexpand: withDoc(cljNativeFunctionWithContext("macroexpand", function macroexpandImpl(ctx, callEnv, form) {
    let current = form;
    while (true) {
      if (!isList(current) || current.value.length === 0)
        return current;
      const head = current.value[0];
      if (!isSymbol(head))
        return current;
      const macroValue = tryLookup(head.name, callEnv);
      if (macroValue === undefined)
        return current;
      if (!isMacro(macroValue))
        return current;
      current = ctx.applyMacro(macroValue, current.value.slice(1));
    }
  }), joinLines([
    "Expands all macros until the expansion is stable (head is no longer a macro)",
    "",
    "Note neither macroexpand-1 nor macroexpand will expand macros in sub-forms"
  ]), [["form"]]),
  "macroexpand-all": withDoc(cljNativeFunctionWithContext("macroexpand-all", function macroexpandAllImpl(ctx, callEnv, form) {
    return ctx.expandAll(form, callEnv);
  }), joinLines([
    "Fully expands all macros in a form recursively — including in sub-forms.",
    "",
    "Unlike macroexpand, this descends into every sub-expression.",
    "Expansion stops at quote/quasiquote boundaries and fn/loop bodies."
  ]), [["form"]]),
  namespace: withDoc(cljNativeFunction("namespace", function namespaceImpl(x) {
    if (x === undefined) {
      throw EvaluationError.atArg("namespace expects an argument", { x }, 0);
    }
    let raw;
    if (isKeyword(x)) {
      raw = x.name.slice(1);
    } else if (isSymbol(x)) {
      raw = x.name;
    } else {
      throw EvaluationError.atArg(`namespace expects a keyword or symbol, got ${printString(x)}`, { x }, 0);
    }
    const slashIdx = raw.indexOf("/");
    if (slashIdx <= 0)
      return cljNil();
    return cljString(raw.slice(0, slashIdx));
  }), "Returns the namespace string of a qualified keyword or symbol, or nil if the argument is not qualified.", [["x"]]),
  name: withDoc(cljNativeFunction("name", function nameImpl(x) {
    if (x === undefined) {
      throw EvaluationError.atArg("name expects an argument", { x }, 0);
    }
    let raw;
    if (isKeyword(x)) {
      raw = x.name.slice(1);
    } else if (isSymbol(x)) {
      raw = x.name;
    } else if (x.kind === "string") {
      return x;
    } else {
      throw EvaluationError.atArg(`name expects a keyword, symbol, or string, got ${printString(x)}`, { x }, 0);
    }
    const slashIdx = raw.indexOf("/");
    return cljString(slashIdx >= 0 ? raw.slice(slashIdx + 1) : raw);
  }), "Returns the local name of a qualified keyword or symbol, or the string value if the argument is a string.", [["x"]]),
  keyword: withDoc(cljNativeFunction("keyword", function keywordImpl(...args) {
    if (args.length === 0 || args.length > 2) {
      throw new EvaluationError("keyword expects 1 or 2 string arguments", {
        args
      });
    }
    if (args[0].kind !== "string") {
      throw EvaluationError.atArg(`keyword expects a string, got ${printString(args[0])}`, { args }, 0);
    }
    if (args.length === 1) {
      return cljKeyword(`:${args[0].value}`);
    }
    if (args[1].kind !== "string") {
      throw EvaluationError.atArg(`keyword second argument must be a string, got ${printString(args[1])}`, { args }, 1);
    }
    return cljKeyword(`:${args[0].value}/${args[1].value}`);
  }), joinLines([
    "Constructs a keyword with the given name and namespace strings. Returns a keyword value.",
    "",
    "Note: do not use : in the keyword strings, it will be added automatically.",
    'e.g. (keyword "foo") => :foo'
  ]), [["name"], ["ns", "name"]]),
  boolean: withDoc(cljNativeFunction("boolean", function booleanImpl(x) {
    if (x === undefined)
      return cljBoolean(false);
    return cljBoolean(isTruthy(x));
  }), "Coerces to boolean. Everything is true except false and nil.", [["x"]])
};

// src/core/stdlib/vars.ts
var varFunctions = {
  "var?": withDoc(cljNativeFunction("var?", function isVarImpl(x) {
    return cljBoolean(isVar(x));
  }), "Returns true if x is a Var.", [["x"]]),
  "var-get": withDoc(cljNativeFunction("var-get", function varGetImpl(x) {
    if (!isVar(x)) {
      throw new EvaluationError(`var-get expects a Var, got ${x.kind}`, { x });
    }
    return x.value;
  }), "Returns the value in the Var object.", [["x"]]),
  "alter-var-root": withDoc(cljNativeFunctionWithContext("alter-var-root", function alterVarRootImpl(ctx, callEnv, varVal, f, ...args) {
    if (!isVar(varVal)) {
      throw new EvaluationError(`alter-var-root expects a Var as its first argument, got ${varVal.kind}`, { varVal });
    }
    if (!isAFunction(f)) {
      throw new EvaluationError(`alter-var-root expects a function as its second argument, got ${f.kind}`, { f });
    }
    const newVal = ctx.applyFunction(f, [varVal.value, ...args], callEnv);
    varVal.value = newVal;
    return newVal;
  }), "Atomically alters the root binding of var v by applying f to its current value plus any additional args.", [["v", "f", "&", "args"]])
};

// src/core/core-env.ts
var nativeFunctions = {
  ...arithmeticFunctions,
  ...atomFunctions,
  ...collectionFunctions,
  ...errorFunctions,
  ...predicateFunctions,
  ...hofFunctions,
  ...metaFunctions,
  ...transducerFunctions,
  ...regexFunctions,
  ...stringFunctions,
  ...utilFunctions,
  ...varFunctions
};
function loadCoreFunctions(env, output) {
  for (const [key, value] of Object.entries(nativeFunctions)) {
    internVar(key, value, env);
  }
  const emit = output ?? ((text) => console.log(text));
  internVar("println", cljNativeFunction("println", (...args) => {
    emit(args.map(valueToString).join(" ") + `
`);
    return cljNil();
  }), env);
  internVar("print", cljNativeFunction("print", (...args) => {
    emit(args.map(valueToString).join(" "));
    return cljNil();
  }), env);
  internVar("newline", cljNativeFunction("newline", () => {
    emit(`
`);
    return cljNil();
  }), env);
}

// src/core/scanners.ts
var createCursor = (line, col, offset) => ({
  line,
  col,
  offset
});
var makeScannerPrimitives = (input, cursor) => {
  return {
    peek: (ahead = 0) => {
      const idx = cursor.offset + ahead;
      if (idx >= input.length)
        return null;
      return input[idx];
    },
    isAtEnd: () => {
      return cursor.offset >= input.length;
    },
    position: () => {
      return {
        offset: cursor.offset,
        line: cursor.line,
        col: cursor.col
      };
    }
  };
};
function makeCharScanner(input) {
  const cursor = createCursor(0, 0, 0);
  const api = {
    ...makeScannerPrimitives(input, cursor),
    advance: () => {
      if (cursor.offset >= input.length)
        return null;
      const ch = input[cursor.offset];
      cursor.offset++;
      if (ch === `
`) {
        cursor.line++;
        cursor.col = 0;
      } else {
        cursor.col++;
      }
      return ch;
    },
    consumeWhile(predicate) {
      const buffer = [];
      while (!api.isAtEnd() && predicate(api.peek())) {
        buffer.push(api.advance());
      }
      return buffer.join("");
    }
  };
  return api;
}
function makeTokenScanner(input) {
  const cursor = createCursor(0, 0, 0);
  const api = {
    ...makeScannerPrimitives(input, cursor),
    advance: () => {
      if (cursor.offset >= input.length)
        return null;
      const token = input[cursor.offset];
      cursor.offset++;
      cursor.col = token.end.col;
      cursor.line = token.end.line;
      return token;
    },
    consumeWhile(predicate) {
      const buffer = [];
      while (!api.isAtEnd() && predicate(api.peek())) {
        buffer.push(api.advance());
      }
      return buffer;
    },
    consumeN(n) {
      for (let i = 0;i < n; i++) {
        api.advance();
      }
    }
  };
  return api;
}

// src/core/tokenizer.ts
var isNewline = (char) => char === `
`;
var isWhitespace = (char) => [" ", ",", `
`, "\r", "\t"].includes(char);
var isComment = (char) => char === ";";
var isLParen = (char) => char === "(";
var isRParen = (char) => char === ")";
var isLBracket = (char) => char === "[";
var isRBracket = (char) => char === "]";
var isLBrace = (char) => char === "{";
var isRBrace = (char) => char === "}";
var isDoubleQuote = (char) => char === '"';
var isSingleQuote = (char) => char === "'";
var isBacktick = (char) => char === "`";
var isTilde = (char) => char === "~";
var isAt = (char) => char === "@";
var isNumber = (char) => {
  const parsed = parseInt(char);
  if (isNaN(parsed)) {
    return false;
  }
  return parsed >= 0 && parsed <= 9;
};
var isDot = (char) => char === ".";
var isKeywordStart = (char) => char === ":";
var isHash = (char) => char === "#";
var isCaret = (char) => char === "^";
var isDelimiter = (char) => isLParen(char) || isRParen(char) || isLBracket(char) || isRBracket(char) || isLBrace(char) || isRBrace(char) || isBacktick(char) || isSingleQuote(char) || isAt(char) || isCaret(char);
var parseWhitespace = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.consumeWhile(isWhitespace);
  return {
    kind: tokenKeywords.Whitespace,
    start,
    end: scanner.position()
  };
};
var parseComment = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  const value = scanner.consumeWhile((char) => !isNewline(char));
  if (!scanner.isAtEnd() && scanner.peek() === `
`) {
    scanner.advance();
  }
  return {
    kind: tokenKeywords.Comment,
    value,
    start,
    end: scanner.position()
  };
};
var parseString = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  const buffer = [];
  let foundClosingQuote = false;
  while (!scanner.isAtEnd()) {
    const ch = scanner.peek();
    if (ch === "\\") {
      scanner.advance();
      const nextChar = scanner.peek();
      switch (nextChar) {
        case '"':
          buffer.push('"');
          break;
        case "\\":
          buffer.push("\\");
          break;
        case "n":
          buffer.push(`
`);
          break;
        case "r":
          buffer.push("\r");
          break;
        case "t":
          buffer.push("\t");
          break;
        default:
          buffer.push(nextChar);
      }
      if (!scanner.isAtEnd()) {
        scanner.advance();
      }
      continue;
    }
    if (ch === '"') {
      scanner.advance();
      foundClosingQuote = true;
      break;
    }
    buffer.push(scanner.advance());
  }
  if (!foundClosingQuote) {
    throw new TokenizerError(`Unterminated string detected at ${start.offset}`, scanner.position());
  }
  return {
    kind: tokenKeywords.String,
    value: buffer.join(""),
    start,
    end: scanner.position()
  };
};
var parseKeyword = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  const value = scanner.consumeWhile((char) => isKeywordStart(char) || !isWhitespace(char) && !isDelimiter(char) && !isComment(char));
  return {
    kind: tokenKeywords.Keyword,
    value,
    start,
    end: scanner.position()
  };
};
function isNumberToken(char, ctx) {
  const scanner = ctx.scanner;
  const next = scanner.peek(1);
  return isNumber(char) || char === "-" && next !== null && isNumber(next);
}
var parseNumber = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  let value = "";
  if (scanner.peek() === "-") {
    value += scanner.advance();
  }
  value += scanner.consumeWhile(isNumber);
  if (!scanner.isAtEnd() && scanner.peek() === "." && scanner.peek(1) !== null && isNumber(scanner.peek(1))) {
    value += scanner.advance();
    value += scanner.consumeWhile(isNumber);
  }
  if (!scanner.isAtEnd() && (scanner.peek() === "e" || scanner.peek() === "E")) {
    value += scanner.advance();
    if (!scanner.isAtEnd() && (scanner.peek() === "+" || scanner.peek() === "-")) {
      value += scanner.advance();
    }
    const exponentDigits = scanner.consumeWhile(isNumber);
    if (exponentDigits.length === 0) {
      throw new TokenizerError(`Invalid number format at line ${start.line} column ${start.col}: "${value}"`, { start, end: scanner.position() });
    }
    value += exponentDigits;
  }
  if (!scanner.isAtEnd() && isDot(scanner.peek())) {
    throw new TokenizerError(`Invalid number format at line ${start.line} column ${start.col}: "${value}${scanner.consumeWhile((ch) => !isWhitespace(ch) && !isDelimiter(ch))}"`, { start, end: scanner.position() });
  }
  return {
    kind: tokenKeywords.Number,
    value: Number(value),
    start,
    end: scanner.position()
  };
};
var parseSymbol = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  const value = scanner.consumeWhile((char) => !isWhitespace(char) && !isDelimiter(char) && !isComment(char));
  return {
    kind: tokenKeywords.Symbol,
    value,
    start,
    end: scanner.position()
  };
};
var parseDerefToken = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  return { kind: "Deref", start, end: scanner.position() };
};
var parseMetaToken = (ctx) => {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  return { kind: "Meta", start, end: scanner.position() };
};
var parseRegexLiteral = (ctx, start) => {
  const scanner = ctx.scanner;
  scanner.advance();
  const buffer = [];
  let foundClosingQuote = false;
  while (!scanner.isAtEnd()) {
    const ch = scanner.peek();
    if (ch === "\\") {
      scanner.advance();
      const next = scanner.peek();
      if (next === null) {
        throw new TokenizerError(`Unterminated regex literal at ${start.offset}`, scanner.position());
      }
      if (next === '"') {
        buffer.push('"');
      } else {
        buffer.push("\\");
        buffer.push(next);
      }
      scanner.advance();
      continue;
    }
    if (ch === '"') {
      scanner.advance();
      foundClosingQuote = true;
      break;
    }
    buffer.push(scanner.advance());
  }
  if (!foundClosingQuote) {
    throw new TokenizerError(`Unterminated regex literal at ${start.offset}`, scanner.position());
  }
  return {
    kind: tokenKeywords.Regex,
    value: buffer.join(""),
    start,
    end: scanner.position()
  };
};
function parseDispatch(ctx) {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  const next = scanner.peek();
  if (next === "(") {
    scanner.advance();
    return { kind: tokenKeywords.AnonFnStart, start, end: scanner.position() };
  }
  if (next === '"') {
    return parseRegexLiteral(ctx, start);
  }
  if (next === "'") {
    scanner.advance();
    return { kind: tokenKeywords.VarQuote, start, end: scanner.position() };
  }
  if (next === "{") {
    throw new TokenizerError("Set literals are not yet supported", start);
  }
  throw new TokenizerError(`Unknown dispatch character: #${next ?? "EOF"}`, start);
}
function parseCharToken(kind, value) {
  return (ctx) => {
    const scanner = ctx.scanner;
    const start = scanner.position();
    scanner.advance();
    return {
      kind,
      value,
      start,
      end: scanner.position()
    };
  };
}
function parseTilde(ctx) {
  const scanner = ctx.scanner;
  const start = scanner.position();
  scanner.advance();
  const nextChar = scanner.peek();
  if (!nextChar) {
    throw new TokenizerError(`Unexpected end of input while parsing unquote at ${start.offset}`, start);
  }
  if (isAt(nextChar)) {
    scanner.advance();
    return {
      kind: tokenKeywords.UnquoteSplicing,
      value: tokenSymbols.UnquoteSplicing,
      start,
      end: scanner.position()
    };
  }
  return {
    kind: tokenKeywords.Unquote,
    value: tokenSymbols.Unquote,
    start,
    end: scanner.position()
  };
}
var tokenParseEntries = [
  [isWhitespace, parseWhitespace],
  [isComment, parseComment],
  [isLParen, parseCharToken(tokenKeywords.LParen, tokenSymbols.LParen)],
  [isRParen, parseCharToken(tokenKeywords.RParen, tokenSymbols.RParen)],
  [isLBracket, parseCharToken(tokenKeywords.LBracket, tokenSymbols.LBracket)],
  [isRBracket, parseCharToken(tokenKeywords.RBracket, tokenSymbols.RBracket)],
  [isLBrace, parseCharToken(tokenKeywords.LBrace, tokenSymbols.LBrace)],
  [isRBrace, parseCharToken(tokenKeywords.RBrace, tokenSymbols.RBrace)],
  [isDoubleQuote, parseString],
  [isKeywordStart, parseKeyword],
  [isNumberToken, parseNumber],
  [isSingleQuote, parseCharToken(tokenKeywords.Quote, tokenSymbols.Quote)],
  [
    isBacktick,
    parseCharToken(tokenKeywords.Quasiquote, tokenSymbols.Quasiquote)
  ],
  [isTilde, parseTilde],
  [isAt, parseDerefToken],
  [isCaret, parseMetaToken],
  [isHash, parseDispatch]
];
function parseNextToken(ctx) {
  const scanner = ctx.scanner;
  const char = scanner.peek();
  const entry = tokenParseEntries.find(([check]) => check(char, ctx));
  if (entry) {
    const [, parse] = entry;
    return parse(ctx);
  }
  return parseSymbol(ctx);
}
function parseAllTokens(ctx) {
  const tokens = [];
  let error = undefined;
  try {
    while (!ctx.scanner.isAtEnd()) {
      const result = parseNextToken(ctx);
      if (!result) {
        break;
      }
      if (result.kind === tokenKeywords.Whitespace) {
        continue;
      }
      tokens.push(result);
    }
  } catch (e) {
    error = e;
  }
  const parsed = {
    tokens,
    scanner: ctx.scanner,
    error
  };
  return parsed;
}
function getTokenValue(token) {
  if ("value" in token) {
    return token.value;
  }
  return "";
}
function tokenize(input) {
  const inputLength = input.length;
  const scanner = makeCharScanner(input);
  const tokenizationContext = {
    scanner
  };
  const tokensResult = parseAllTokens(tokenizationContext);
  if (tokensResult.error) {
    throw tokensResult.error;
  }
  if (tokensResult.scanner.position().offset !== inputLength) {
    throw new TokenizerError(`Unexpected end of input, expected ${inputLength} characters, got ${tokensResult.scanner.position().offset}`, tokensResult.scanner.position());
  }
  return tokensResult.tokens;
}

// src/core/reader.ts
function readAtom(ctx) {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input", scanner.position());
  }
  switch (token.kind) {
    case tokenKeywords.Symbol:
      return readSymbol(scanner);
    case tokenKeywords.String: {
      scanner.advance();
      const val = { kind: "string", value: token.value };
      setPos(val, { start: token.start.offset, end: token.end.offset });
      return val;
    }
    case tokenKeywords.Number: {
      scanner.advance();
      const val = { kind: "number", value: token.value };
      setPos(val, { start: token.start.offset, end: token.end.offset });
      return val;
    }
    case tokenKeywords.Keyword: {
      scanner.advance();
      const kwName = token.value;
      let val;
      if (kwName.startsWith("::")) {
        const rest = kwName.slice(2);
        if (rest.includes("/")) {
          const slashIdx = rest.indexOf("/");
          const alias = rest.slice(0, slashIdx);
          const localName = rest.slice(slashIdx + 1);
          const fullNs = ctx.aliases.get(alias);
          if (!fullNs) {
            throw new ReaderError(`No namespace alias '${alias}' found for ::${alias}/${localName}`, token, { start: token.start.offset, end: token.end.offset });
          }
          val = { kind: "keyword", name: `:${fullNs}/${localName}` };
        } else {
          val = { kind: "keyword", name: `:${ctx.namespace}/${rest}` };
        }
      } else {
        val = { kind: "keyword", name: kwName };
      }
      setPos(val, { start: token.start.offset, end: token.end.offset });
      return val;
    }
  }
  throw new ReaderError(`Unexpected token: ${token.kind}`, token, {
    start: token.start.offset,
    end: token.end.offset
  });
}
var readQuote = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing quote", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  if (!value) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token);
  }
  return { kind: valueKeywords.list, value: [cljSymbol("quote"), value] };
};
var readQuasiquote = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing quasiquote", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  if (!value) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token);
  }
  return { kind: valueKeywords.list, value: [cljSymbol("quasiquote"), value] };
};
var readUnquote = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing unquote", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  if (!value) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token);
  }
  return { kind: valueKeywords.list, value: [cljSymbol("unquote"), value] };
};
var readMeta = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing metadata", scanner.position());
  }
  scanner.advance();
  const metaForm = readForm(ctx);
  const target = readForm(ctx);
  let metaEntries;
  if (metaForm.kind === "keyword") {
    metaEntries = [[metaForm, cljBoolean(true)]];
  } else if (metaForm.kind === "map") {
    metaEntries = metaForm.entries;
  } else if (metaForm.kind === "symbol") {
    metaEntries = [[cljKeyword(":tag"), metaForm]];
  } else {
    throw new ReaderError("Metadata must be a keyword, map, or symbol", token);
  }
  if (target.kind === "symbol" || target.kind === "list" || target.kind === "vector" || target.kind === "map") {
    const existingEntries = target.meta ? target.meta.entries : [];
    const result = { ...target, meta: cljMap([...existingEntries, ...metaEntries]) };
    const pos = getPos(target);
    if (pos)
      setPos(result, pos);
    return result;
  }
  return target;
};
var readVarQuote = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing var quote", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  return cljList([cljSymbol("var"), value]);
};
var readDeref = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing deref", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  if (!value) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token);
  }
  return { kind: valueKeywords.list, value: [cljSymbol("deref"), value] };
};
var readUnquoteSplicing = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input while parsing unquote splicing", scanner.position());
  }
  scanner.advance();
  const value = readForm(ctx);
  if (!value) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token);
  }
  return {
    kind: valueKeywords.list,
    value: [cljSymbol("unquote-splicing"), value]
  };
};
var isClosingToken = (token) => {
  return [
    tokenKeywords.RParen,
    tokenKeywords.RBracket,
    tokenKeywords.RBrace
  ].includes(token.kind);
};
var collectionReader = (valueType, closeToken) => {
  return function(ctx) {
    const scanner = ctx.scanner;
    const startToken = scanner.peek();
    if (!startToken) {
      throw new ReaderError("Unexpected end of input while parsing collection", scanner.position());
    }
    scanner.advance();
    const values = [];
    let pairMatched = false;
    let closingEnd;
    while (!scanner.isAtEnd()) {
      const token = scanner.peek();
      if (!token) {
        break;
      }
      if (isClosingToken(token) && token.kind !== closeToken) {
        throw new ReaderError(`Expected '${closeToken}' to close ${valueType} started at line ${startToken.start.line} column ${startToken.start.col}, but got '${getTokenValue(token)}' at line ${token.start.line} column ${token.start.col}`, token, { start: token.start.offset, end: token.end.offset });
      }
      if (token.kind === closeToken) {
        closingEnd = token.end.offset;
        scanner.advance();
        pairMatched = true;
        break;
      }
      const value = readForm(ctx);
      values.push(value);
    }
    if (!pairMatched) {
      throw new ReaderError(`Unmatched ${valueType} started at line ${startToken.start.line} column ${startToken.start.col}`, scanner.peek());
    }
    const result = { kind: valueType, value: values };
    if (closingEnd !== undefined) {
      setPos(result, { start: startToken.start.offset, end: closingEnd });
    }
    return result;
  };
};
var readList = collectionReader("list", tokenKeywords.RParen);
var readVector = collectionReader("vector", tokenKeywords.RBracket);
var readSymbol = (scanner) => {
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input", scanner.position());
  }
  if (token.kind !== tokenKeywords.Symbol) {
    throw new ReaderError(`Unexpected token: ${getTokenValue(token)}`, token, {
      start: token.start.offset,
      end: token.end.offset
    });
  }
  scanner.advance();
  let val;
  switch (token.value) {
    case "true":
    case "false":
      val = cljBoolean(token.value === "true");
      break;
    case "nil":
      val = cljNil();
      break;
    default:
      val = cljSymbol(token.value);
  }
  setPos(val, { start: token.start.offset, end: token.end.offset });
  return val;
};
var readMap = (ctx) => {
  const scanner = ctx.scanner;
  const startToken = scanner.peek();
  if (!startToken) {
    throw new ReaderError("Unexpected end of input while parsing map", scanner.position());
  }
  let pairMatched = false;
  let closingEnd;
  scanner.advance();
  const entries = [];
  while (!scanner.isAtEnd()) {
    const token = scanner.peek();
    if (!token) {
      break;
    }
    if (isClosingToken(token) && token.kind !== tokenKeywords.RBrace) {
      throw new ReaderError(`Expected '}' to close map started at line ${startToken.start.line} column ${startToken.start.col}, but got '${token.kind}' at line ${token.start.line} column ${token.start.col}`, token, { start: token.start.offset, end: token.end.offset });
    }
    if (token.kind === tokenKeywords.RBrace) {
      closingEnd = token.end.offset;
      scanner.advance();
      pairMatched = true;
      break;
    }
    const key = readForm(ctx);
    const nextToken = scanner.peek();
    if (!nextToken) {
      throw new ReaderError(`Expected value in map started at line ${startToken.start.line} column ${startToken.start.col}, but got end of input`, scanner.position());
    }
    if (nextToken.kind === tokenKeywords.RBrace) {
      throw new ReaderError(`Map started at line ${startToken.start.line} column ${startToken.start.col} has key ${key.kind} but no value`, scanner.position());
    }
    const value = readForm(ctx);
    if (!value) {
      break;
    }
    entries.push([key, value]);
  }
  if (!pairMatched) {
    throw new ReaderError(`Unmatched map started at line ${startToken.start.line} column ${startToken.start.col}`, scanner.peek());
  }
  const result = { kind: valueKeywords.map, entries };
  if (closingEnd !== undefined) {
    setPos(result, { start: startToken.start.offset, end: closingEnd });
  }
  return result;
};
function collectAnonFnParams(forms) {
  let maxIndex = 0;
  let hasRest = false;
  function walk(form) {
    switch (form.kind) {
      case "symbol": {
        const name = form.name;
        if (name === "%" || name === "%1") {
          maxIndex = Math.max(maxIndex, 1);
        } else if (/^%[2-9]$/.test(name)) {
          maxIndex = Math.max(maxIndex, parseInt(name[1]));
        } else if (name === "%&") {
          hasRest = true;
        }
        break;
      }
      case "list":
      case "vector":
        for (const child of form.value)
          walk(child);
        break;
      case "map":
        for (const [k, v] of form.entries) {
          walk(k);
          walk(v);
        }
        break;
      default:
        break;
    }
  }
  for (const form of forms)
    walk(form);
  return { maxIndex, hasRest };
}
function substituteAnonFnParams(form) {
  switch (form.kind) {
    case "symbol": {
      const name = form.name;
      if (name === "%" || name === "%1")
        return cljSymbol("p1");
      if (/^%[2-9]$/.test(name))
        return cljSymbol(`p${name[1]}`);
      if (name === "%&")
        return cljSymbol("rest");
      return form;
    }
    case "list":
      return { ...form, value: form.value.map(substituteAnonFnParams) };
    case "vector":
      return { ...form, value: form.value.map(substituteAnonFnParams) };
    case "map":
      return {
        ...form,
        entries: form.entries.map(([k, v]) => [substituteAnonFnParams(k), substituteAnonFnParams(v)])
      };
    default:
      return form;
  }
}
var readAnonFn = (ctx) => {
  const scanner = ctx.scanner;
  const startToken = scanner.peek();
  if (!startToken) {
    throw new ReaderError("Unexpected end of input while parsing anonymous function", scanner.position());
  }
  scanner.advance();
  const bodyForms = [];
  let pairMatched = false;
  let closingEnd;
  while (!scanner.isAtEnd()) {
    const token = scanner.peek();
    if (!token)
      break;
    if (isClosingToken(token) && token.kind !== tokenKeywords.RParen) {
      throw new ReaderError(`Expected ')' to close anonymous function started at line ${startToken.start.line} column ${startToken.start.col}, but got '${getTokenValue(token)}' at line ${token.start.line} column ${token.start.col}`, token, { start: token.start.offset, end: token.end.offset });
    }
    if (token.kind === tokenKeywords.RParen) {
      closingEnd = token.end.offset;
      scanner.advance();
      pairMatched = true;
      break;
    }
    if (token.kind === tokenKeywords.AnonFnStart) {
      throw new ReaderError("Nested anonymous functions (#(...)) are not allowed", token, { start: token.start.offset, end: token.end.offset });
    }
    bodyForms.push(readForm(ctx));
  }
  if (!pairMatched) {
    throw new ReaderError(`Unmatched anonymous function started at line ${startToken.start.line} column ${startToken.start.col}`, scanner.peek());
  }
  const bodyList = { kind: "list", value: bodyForms };
  const { maxIndex, hasRest } = collectAnonFnParams([bodyList]);
  const paramSymbols = [];
  for (let i = 1;i <= maxIndex; i++) {
    paramSymbols.push(cljSymbol(`p${i}`));
  }
  if (hasRest) {
    paramSymbols.push(cljSymbol("&"));
    paramSymbols.push(cljSymbol("rest"));
  }
  const substitutedBody = substituteAnonFnParams(bodyList);
  const result = cljList([
    cljSymbol("fn"),
    cljVector(paramSymbols),
    substitutedBody
  ]);
  if (closingEnd !== undefined) {
    setPos(result, { start: startToken.start.offset, end: closingEnd });
  }
  return result;
};
function extractInlineFlags2(raw) {
  let remaining = raw;
  let flags = "";
  const flagGroupRe = /^\(\?([imsx]+)\)/;
  let m;
  while ((m = flagGroupRe.exec(remaining)) !== null) {
    for (const f of m[1]) {
      if (f === "x") {
        throw new ReaderError("Regex flag (?x) (verbose mode) has no JavaScript equivalent and is not supported", null);
      }
      if (!flags.includes(f))
        flags += f;
    }
    remaining = remaining.slice(m[0].length);
  }
  return { pattern: remaining, flags };
}
var readRegex = (ctx) => {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token || token.kind !== tokenKeywords.Regex) {
    throw new ReaderError("Expected regex token", scanner.position());
  }
  scanner.advance();
  const { pattern, flags } = extractInlineFlags2(token.value);
  const val = cljRegex(pattern, flags);
  setPos(val, { start: token.start.offset, end: token.end.offset });
  return val;
};
function readForm(ctx) {
  const scanner = ctx.scanner;
  const token = scanner.peek();
  if (!token) {
    throw new ReaderError("Unexpected end of input", scanner.position());
  }
  switch (token.kind) {
    case tokenKeywords.String:
    case tokenKeywords.Number:
    case tokenKeywords.Keyword:
    case tokenKeywords.Symbol:
      return readAtom(ctx);
    case tokenKeywords.LParen:
      return readList(ctx);
    case tokenKeywords.LBrace:
      return readMap(ctx);
    case tokenKeywords.LBracket:
      return readVector(ctx);
    case tokenKeywords.Quote:
      return readQuote(ctx);
    case tokenKeywords.Quasiquote:
      return readQuasiquote(ctx);
    case tokenKeywords.Unquote:
      return readUnquote(ctx);
    case tokenKeywords.UnquoteSplicing:
      return readUnquoteSplicing(ctx);
    case tokenKeywords.AnonFnStart:
      return readAnonFn(ctx);
    case tokenKeywords.Deref:
      return readDeref(ctx);
    case tokenKeywords.VarQuote:
      return readVarQuote(ctx);
    case tokenKeywords.Meta:
      return readMeta(ctx);
    case tokenKeywords.Regex:
      return readRegex(ctx);
    default:
      throw new ReaderError(`Unexpected token: ${getTokenValue(token)} at line ${token.start.line} column ${token.start.col}`, token, { start: token.start.offset, end: token.end.offset });
  }
}
function readForms(input, currentNs = "user", aliases = new Map) {
  const withoutComments = input.filter((t) => t.kind !== tokenKeywords.Comment);
  const scanner = makeTokenScanner(withoutComments);
  const ctx = {
    scanner,
    namespace: currentNs,
    aliases
  };
  const values = [];
  while (!scanner.isAtEnd()) {
    values.push(readForm(ctx));
  }
  return values;
}

// src/clojure/generated/clojure-core-source.ts
var clojure_coreSource = `(ns clojure.core)

(defmacro defn [name & fdecl]
  (let [doc       (if (string? (first fdecl)) (first fdecl) nil)
        rest-decl (if doc (rest fdecl) fdecl)
        arglists  (if (vector? (first rest-decl))
                    (vector (first rest-decl))
                    (reduce (fn [acc arity] (conj acc (first arity))) [] rest-decl))]
    (if doc
      \`(def ~name (with-meta (fn ~@rest-decl) {:doc ~doc :arglists '~arglists}))
      \`(def ~name (with-meta (fn ~@rest-decl) {:arglists '~arglists})))))


(defn vary-meta
  "Returns an object of the same type and value as obj, with
  (apply f (meta obj) args) as its metadata."
  [obj f & args]
  (with-meta obj (apply f (meta obj) args)))

(defn next
  "Returns a seq of the items after the first. Calls seq on its
  argument.  If there are no more items, returns nil."
  [coll]
  (seq (rest coll)))

(defn not
  "Returns true if x is logical false, false otherwise."
  [x] (if x false true))

(defn second
  "Same as (first (next x))"
  [coll]
  (first (next coll)))


(defmacro when [condition & body]
  \`(if ~condition (do ~@body) nil))

(defmacro when-not [condition & body]
  \`(if ~condition nil (do ~@body)))

(defmacro if-let
  ([bindings then] \`(if-let ~bindings ~then nil))
  ([bindings then else]
   (let [form (first bindings)
         tst  (second bindings)]
     \`(let [~form ~tst]
        (if ~form ~then ~else)))))

(defmacro when-let [bindings & body]
  (let [form (first bindings)
        tst  (second bindings)]
    \`(let [~form ~tst]
       (when ~form ~@body))))

(defmacro and [& forms]
  (if (nil? forms)
    true
    (if (nil? (seq (rest forms)))
      (first forms)
      \`(let [v# ~(first forms)]
         (if v# (and ~@(rest forms)) v#)))))

(defmacro or [& forms]
  (if (nil? forms)
    nil
    (if (nil? (seq (rest forms)))
      (first forms)
      \`(let [v# ~(first forms)]
         (if v# v# (or ~@(rest forms)))))))

(defmacro cond [& clauses]
  (if (nil? clauses)
    nil
    \`(if ~(first clauses)
       ~(first (next clauses))
       (cond ~@(rest (rest clauses))))))

(defmacro -> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     \`(~(first form) ~x ~@(rest form))
                     \`(~form ~x))]
      \`(-> ~threaded ~@more))))

(defmacro ->> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     \`(~(first form) ~@(rest form) ~x)
                     \`(~form ~x))]
      \`(->> ~threaded ~@more))))

(defmacro comment
  ; Ignores body, yields nil
  [& body])

(defn constantly
  "Returns a function that takes any number of arguments and returns x."
  [x] (fn [& _] x))

(defn some?
  "Returns true if x is not nil, false otherwise"
  [x] (not (nil? x)))

(defn any?
  "Returns true for any given argument"
  [_x] true)

(defn complement
  "Takes a fn f and returns a fn that takes the same arguments as f,
  has the same effects, if any, and returns the opposite truth value."
  [f]
  (fn
    ([] (not (f)))
    ([x] (not (f x)))
    ([x y] (not (f x y)))
    ([x y & zs] (not (apply f x y zs)))))

(defn juxt
  "Takes a set of functions and returns a fn that is the juxtaposition
  of those fns. The returned fn takes a variable number of args and
  returns a vector containing the result of applying each fn to the args."
  [& fns]
  (fn [& args]
    (reduce (fn [acc f] (conj acc (apply f args))) [] fns)))

(defn merge
  "Returns a map that consists of the rest of the maps conj-ed onto
  the first. If a key occurs in more than one map, the mapping from
  the latter (left-to-right) will be the mapping in the result."
  [& maps]
  (if (nil? maps)
    nil
    (reduce
     (fn [acc m]
       (if (nil? m)
         acc
         (if (nil? acc)
           m
           (reduce
            (fn [macc entry]
              (assoc macc (first entry) (second entry)))
            acc
            m))))
     nil
     maps)))

(defn select-keys
  "Returns a map containing only those entries in map whose key is in keys."
  [m keys]
  (if (or (nil? m) (nil? keys))
    {}
    (let [missing (gensym)]
      (reduce
       (fn [acc k]
         (let [v (get m k missing)]
           (if (= v missing)
             acc
             (assoc acc k v))))
       {}
       keys))))

(defn update
  "Updates a value in an associative structure where k is a key and f is a
  function that will take the old value and any supplied args and return the
  new value, and returns a new structure."
  [m k f & args]
  (let [target (if (nil? m) {} m)]
    (assoc target k (if (nil? args)
                      (f (get target k))
                      (apply f (get target k) args)))))

(defn get-in
  "Returns the value in a nested associative structure, where ks is a
  sequence of keys. Returns nil if the key is not present, or the not-found
  value if supplied."
  ([m ks]
   (reduce get m ks))
  ([m ks not-found]
   (loop [m m, ks (seq ks)]
     (if (nil? ks)
       m
       (if (contains? m (first ks))
         (recur (get m (first ks)) (next ks))
         not-found)))))

(defn assoc-in
  "Associates a value in a nested associative structure, where ks is a
  sequence of keys and v is the new value. Returns a new nested structure."
  [m [k & ks] v]
  (if ks
    (assoc m k (assoc-in (get m k) ks v))
    (assoc m k v)))

(defn update-in
  "Updates a value in a nested associative structure, where ks is a
  sequence of keys and f is a function that will take the old value and any
  supplied args and return the new value. Returns a new nested structure."
  [m ks f & args]
  (assoc-in m ks (apply f (get-in m ks) args)))

(defn fnil
  "Takes a function f, and returns a function that calls f, replacing
  a nil first argument with x, optionally nil second with y, nil third with z."
  ([f x]
   (fn [a & more]
     (apply f (if (nil? a) x a) more)))
  ([f x y]
   (fn [a b & more]
     (apply f (if (nil? a) x a) (if (nil? b) y b) more)))
  ([f x y z]
   (fn [a b c & more]
     (apply f (if (nil? a) x a) (if (nil? b) y b) (if (nil? c) z c) more))))

(defn frequencies
  "Returns a map from distinct items in coll to the number of times they appear."
  [coll]
  (if (nil? coll)
    {}
    (reduce
     (fn [counts item]
       (assoc counts item (inc (get counts item 0))))
     {}
     coll)))

(defn group-by
  "Returns a map of the elements of coll keyed by the result of f on each
  element. The value at each key is a vector of matching elements."
  [f coll]
  (if (nil? coll)
    {}
    (reduce
     (fn [acc item]
       (let [k (f item)]
         (assoc acc k (conj (get acc k []) item))))
     {}
     coll)))

(defn distinct
  "Returns a vector of the elements of coll with duplicates removed,
  preserving first-seen order."
  [coll]
  (if (nil? coll)
    []
    (get
     (reduce
      (fn [state item]
        (let [seen (get state 0)
              out  (get state 1)]
          (if (get seen item false)
            state
            [(assoc seen item true) (conj out item)])))
      [{} []]
      coll)
     1)))

(defn flatten-step
  "Internal helper for flatten."
  [v]
  (if (or (list? v) (vector? v))
    (reduce
     (fn [acc item]
       (into acc (flatten-step item)))
     []
     v)
    [v]))

(defn flatten
  "Takes any nested combination of sequential things (lists/vectors) and
  returns their contents as a single flat vector."
  [x]
  (if (nil? x)
    []
    (flatten-step x)))

(defn reduce-kv
  "Reduces an associative structure. f should be a function of 3
  arguments: accumulator, key/index, value."
  [f init coll]
  (cond
    (map? coll)
    (reduce
     (fn [acc entry]
       (f acc (first entry) (second entry)))
     init
     coll)

    (vector? coll)
    (loop [idx 0
           acc init]
      (if (< idx (count coll))
        (recur (inc idx) (f acc idx (nth coll idx)))
        acc))

    :else
    (throw
     (ex-info
      "reduce-kv expects a map or vector"
      {:coll coll}))))

(defn sort-compare
  "Internal helper: normalizes comparator results."
  [cmp a b]
  (let [r (cmp a b)]
    (if (number? r)
      (< r 0)
      r)))

(defn insert-sorted
  "Internal helper for insertion-sort based sort implementation."
  [cmp x sorted]
  (loop [left  []
         right sorted]
    (if (nil? (seq right))
      (conj left x)
      (let [y (first right)]
        (if (sort-compare cmp x y)
          (into (conj left x) right)
          (recur (conj left y) (rest right)))))))

(defn sort
  "Returns the items in coll in sorted order. With no comparator, sorts
  ascending using <. Comparator may return boolean or number."
  ([coll] (sort < coll))
  ([cmp coll]
   (if (nil? coll)
     []
     (reduce
      (fn [acc item]
        (insert-sorted cmp item acc))
      []
      coll))))

(defn sort-by
  "Returns a sorted sequence of items in coll, where the sort order is
  determined by comparing (keyfn item)."
  ([keyfn coll] (sort-by keyfn < coll))
  ([keyfn cmp coll]
   (sort
    (fn [a b]
      (cmp (keyfn a) (keyfn b)))
    coll)))

(def not-any? (comp not some))

(defn not-every?
  "Returns false if (pred x) is logical true for every x in
  coll, else true."
  [pred coll] (not (every? pred coll)))

;; ── Transducer protocol ──────────────────────────────────────────────────────

;; into: 2-arity uses reduce+conj; 3-arity uses transduce
(defn into
  "Returns a new coll consisting of to-coll with all of the items of
   from-coll conjoined. A transducer may be supplied."
  ([to from] (reduce conj to from))
  ([to xf from] (transduce xf conj to from)))

;; sequence: materialise a transducer over a collection into a seq (list)
(defn sequence
  "Coerces coll to a (possibly empty) sequence, if it is not already
  one. Will not force a seq. (sequence nil) yields (), When a
  transducer is supplied, returns a lazy sequence of applications of
  the transform to the items in coll"
  ([coll] (apply list (into [] coll)))
  ([xf coll] (apply list (into [] xf coll))))

(defn completing
  "Takes a reducing function f of 2 args and returns a fn suitable for
  transduce by adding an arity-1 signature that calls cf (default -
  identity) on the result argument."
  ([f] (completing f identity))
  ([f cf]
   (fn
     ([] (f))
     ([x] (cf x))
     ([x y] (f x y)))))

;; map: 1-arg returns transducer; 2-arg is eager; 3+-arg zips collections
(defn map
  "Returns a sequence consisting of the result of applying f to the set
  of first items of each coll, followed by applying f to the set of
  second items in each coll, until any one of the colls is exhausted.
  Any remaining items in other colls are ignored. Returns a transducer
  when no collection is provided."
  ([f]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input] (rf result (f input))))))
  ([f coll]
   (sequence (map f) coll))
  ([f c1 c2]
   (loop [s1 (seq c1)
          s2 (seq c2)
          acc []]
     (if (or (nil? s1) (nil? s2))
       acc
       (recur
        (next s1)
        (next s2)
        (conj acc (f (first s1) (first s2)))))))
  ([f c1 c2 & colls]
   (loop [seqs (map seq (cons c1 (cons c2 colls)))
          acc []]
     (if (some nil? seqs)
       acc
       (recur (map next seqs) (conj acc (apply f (map first seqs))))))))

;; filter: 1-arg returns transducer; 2-arg is eager
(defn filter
  "Returns a sequence of the items in coll for which
  (pred item) returns logical true. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          result)))))
  ([pred coll]
   (sequence (filter pred) coll)))

(defn remove
  "Returns a lazy sequence of the items in coll for which
  (pred item) returns logical false. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred] (filter (complement pred)))
  ([pred coll]
   (filter (complement pred) coll)))



;; take: stateful transducer; signals early termination after n items
;; r > 0 → keep going; r = 0 → take last item and stop; r < 0 → already past limit, stop
(defn take
  "Returns a sequence of the first n items in coll, or all items if
  there are fewer than n.  Returns a stateful transducer when
  no collection is provided."
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [n @remaining
                nrem (vswap! remaining dec)
                result (if (pos? n)
                         (rf result input)
                         result)]
            (if (not (pos? nrem))
              (ensure-reduced result)
              result)))))))
  ([n coll]
   (sequence (take n) coll)))

;; take-while: stateless transducer; emits reduced when pred fails
(defn take-while
  "Returns a sequence of successive items from coll while
  (pred item) returns logical true. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          (reduced result))))))
  ([pred coll]
   (sequence (take-while pred) coll)))

;; drop: stateful transducer; skips first n items
;; r >= 0 → still skipping; r < 0 → past the drop zone, start taking
(defn drop
  "Returns a sequence of all but the first n items in coll.
   Returns a stateful transducer when no collection is provided."
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [rem @remaining]
            (vswap! remaining dec)
            (if (pos? rem)
              result
              (rf result input))))))))
  ([n coll]
   (sequence (drop n) coll)))

(defn drop-last
  "Return a sequence of all but the last n (default 1) items in coll"
  ([coll] (drop-last 1 coll))
  ([n coll] (map (fn [x _] x) coll (drop n coll))))

(defn take-last
  "Returns a sequence of the last n items in coll.  Depending on the type
  of coll may be no better than linear time.  For vectors, see also subvec."
  [n coll]
  (loop [s (seq coll), lead (seq (drop n coll))]
    (if lead
      (recur (next s) (next lead))
      s)))

;; drop-while: stateful transducer; passes through once pred fails
(defn drop-while
  "Returns a sequence of the items in coll starting from the
  first item for which (pred item) returns logical false.  Returns a
  stateful transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (let [dropping (volatile! true)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (if (and @dropping (pred input))
            result
            (do
              (vreset! dropping false)
              (rf result input))))))))
  ([pred coll]
   (sequence (drop-while pred) coll)))

;; map-indexed: stateful transducer; passes index and item to f
(defn map-indexed
  "Returns a sequence consisting of the result of applying f to 0
   and the first item of coll, followed by applying f to 1 and the second
   item in coll, etc, until coll is exhausted. Thus function f should
   accept 2 arguments, index and item. Returns a stateful transducer when
   no collection is provided."
  ([f]
   (fn [rf]
     (let [i (volatile! -1)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (rf result (f (vswap! i inc) input)))))))
  ([f coll]
   (sequence (map-indexed f) coll)))

;; dedupe: stateful transducer; removes consecutive duplicates
(defn dedupe
  "Returns a sequence removing consecutive duplicates in coll.
   Returns a transducer when no collection is provided."
  ([]
   (fn [rf]
     (let [pv (volatile! ::none)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [prior @pv]
            (vreset! pv input)
            (if (= prior input)
              result
              (rf result input))))))))
  ([coll]
   (sequence (dedupe) coll)))

;; partition-all: stateful transducer; groups items into vectors of size n
(defn partition-all
  "Returns a sequence of lists like partition, but may include
   partitions with fewer than n items at the end.  Returns a stateful
   transducer when no collection is provided."
  ([n]
   (fn [rf]
     (let [buf (volatile! [])]
       (fn
         ([] (rf))
         ([result]
          (let [b @buf]
            (vreset! buf [])
            (if (empty? b)
              (rf result)
              (rf (unreduced (rf result b))))))
         ([result input]
          (let [nb (conj @buf input)]
            (if (= (count nb) n)
              (do
                (vreset! buf [])
                (rf result nb))
              (do
                (vreset! buf nb)
                result))))))))
  ([n coll]
   (sequence (partition-all n) coll)))

;; ── Documentation ────────────────────────────────────────────────────────────

(defmacro doc [sym]
  \`(let [v#        ~sym
         m#        (meta v#)
         d#        (:doc m#)
         args#     (:arglists m#)
         args-str# (when args#
                     (str "("
                          (reduce
                           (fn [acc# a#]
                             (if (= acc# "")
                               (str a#)
                               (str acc# " " a#)))
                           ""
                           args#)
                          ")"))]
     (println (str "-------------------------\\n"
                   ~(str sym) "\\n"
                   (if args-str# (str args-str# "\\n") "")
                   "  " (or d# "No documentation available.")))))

(defn err
  "Creates an error map with type, message, data and optionally cause"
  ([type message] (err type message nil nil))
  ([type message data] (err type message data nil))
  ([type message data cause] {:type type :message message :data data :cause cause}))`;

// src/clojure/generated/clojure-string-source.ts
var clojure_stringSource = `(ns clojure.string)

;; Runtime-injected native helpers. Declared here so clojure-lsp can resolve
;; them; the interpreter treats bare (def name) as a no-op and leaves the
;; native binding from coreEnv intact.
(def str-split*)
(def str-upper-case*)
(def str-lower-case*)
(def str-trim*)
(def str-triml*)
(def str-trimr*)
(def str-reverse*)
(def str-starts-with*)
(def str-ends-with*)
(def str-includes*)
(def str-index-of*)
(def str-last-index-of*)
(def str-replace*)
(def str-replace-first*)

;; ---------------------------------------------------------------------------
;; Joining / splitting
;; ---------------------------------------------------------------------------

(defn join
  "Returns a string of all elements in coll, as returned by (str), separated
  by an optional separator."
  ([coll] (join "" coll))
  ([separator coll]
   (if (nil? coll)
     ""
     (reduce
      (fn [acc x]
        (if (= acc "")
          (str x)
          (str acc separator x)))
      ""
      coll))))

(defn split
  "Splits string on a regular expression. Optional limit is the maximum number
  of parts returned. Trailing empty strings are not returned by default; pass
  a limit of -1 to return all."
  ([s sep] (str-split* s sep))
  ([s sep limit] (str-split* s sep limit)))

(defn split-lines
  "Splits s on \\\\n or \\\\r\\\\n. Trailing empty lines are not returned."
  [s]
  (split s #"\\r?\\n"))

;; ---------------------------------------------------------------------------
;; Case conversion
;; ---------------------------------------------------------------------------

(defn upper-case
  "Converts string to all upper-case."
  [s]
  (str-upper-case* s))

(defn lower-case
  "Converts string to all lower-case."
  [s]
  (str-lower-case* s))

(defn capitalize
  "Converts first character of the string to upper-case, all other
  characters to lower-case."
  [s]
  (if (< (count s) 2)
    (upper-case s)
    (str (upper-case (subs s 0 1)) (lower-case (subs s 1)))))

;; ---------------------------------------------------------------------------
;; Trimming
;; ---------------------------------------------------------------------------

(defn trim
  "Removes whitespace from both ends of string."
  [s]
  (str-trim* s))

(defn triml
  "Removes whitespace from the left side of string."
  [s]
  (str-triml* s))

(defn trimr
  "Removes whitespace from the right side of string."
  [s]
  (str-trimr* s))

(defn trim-newline
  "Removes all trailing newline \\\\n or return \\\\r characters from string.
  Similar to Perl's chomp."
  [s]
  (replace s #"[\\r\\n]+$" ""))

;; ---------------------------------------------------------------------------
;; Predicates
;; ---------------------------------------------------------------------------

(defn blank?
  "True if s is nil, empty, or contains only whitespace."
  [s]
  (or (nil? s) (not (nil? (re-matches #"\\s*" s)))))

(defn starts-with?
  "True if s starts with substr."
  [s substr]
  (str-starts-with* s substr))

(defn ends-with?
  "True if s ends with substr."
  [s substr]
  (str-ends-with* s substr))

(defn includes?
  "True if s includes substr."
  [s substr]
  (str-includes* s substr))

;; ---------------------------------------------------------------------------
;; Search
;; ---------------------------------------------------------------------------

(defn index-of
  "Return index of value (string) in s, optionally searching forward from
  from-index. Return nil if value not found."
  ([s value] (str-index-of* s value))
  ([s value from-index] (str-index-of* s value from-index)))

(defn last-index-of
  "Return last index of value (string) in s, optionally searching backward
  from from-index. Return nil if value not found."
  ([s value] (str-last-index-of* s value))
  ([s value from-index] (str-last-index-of* s value from-index)))

;; ---------------------------------------------------------------------------
;; Replacement
;; ---------------------------------------------------------------------------

(defn replace
  "Replaces all instances of match with replacement in s.

  match/replacement can be:
    string / string   — literal match, literal replacement
    pattern / string  — regex match; $1, $2, etc. substituted from groups
    pattern / fn      — regex match; fn called with match (string or vector
                        of [whole g1 g2 ...]), return value used as replacement.

  See also replace-first."
  [s match replacement]
  (str-replace* s match replacement))

(defn replace-first
  "Replaces the first instance of match with replacement in s.
  Same match/replacement semantics as replace."
  [s match replacement]
  (str-replace-first* s match replacement))

(defn re-quote-replacement
  "Given a replacement string that you wish to be a literal replacement for a
  pattern match in replace or replace-first, escape any special replacement
  characters ($ signs) so they are treated literally."
  [s]
  (replace s #"\\$" "$$$$"))

;; ---------------------------------------------------------------------------
;; Miscellaneous
;; ---------------------------------------------------------------------------

(defn reverse
  "Returns s with its characters reversed."
  [s]
  (str-reverse* s))

(defn escape
  "Return a new string, using cmap to escape each character ch from s as
  follows: if (cmap ch) is nil, append ch to the new string; otherwise append
  (str (cmap ch)).

  cmap may be a map or a function. Maps are callable directly (IFn semantics).

  Note: Clojure uses char literal keys (e.g. {\\\\< \\"&lt;\\"}). This interpreter
  has no char type, so map keys must be single-character strings instead
  (e.g. {\\"<\\" \\"&lt;\\"})."
  [s cmap]
  (apply str (map (fn [c]
                    (let [r (cmap c)]
                      (if (nil? r) c (str r))))
                  (split s #""))))
`;

// src/clojure/generated/builtin-namespace-registry.ts
var builtInNamespaceSources = {
  "clojure.core": () => clojure_coreSource,
  "clojure.string": () => clojure_stringSource
};

// src/core/session.ts
function extractNsNameFromTokens(tokens) {
  const meaningful = tokens.filter((t) => t.kind !== "Comment");
  if (meaningful.length < 3)
    return null;
  if (meaningful[0].kind !== "LParen")
    return null;
  if (meaningful[1].kind !== "Symbol" || meaningful[1].value !== "ns")
    return null;
  if (meaningful[2].kind !== "Symbol")
    return null;
  return meaningful[2].value;
}
function extractAliasMapFromTokens(tokens) {
  const aliases = new Map;
  const meaningful = tokens.filter((t) => t.kind !== "Comment" && t.kind !== "Whitespace");
  if (meaningful.length < 3)
    return aliases;
  if (meaningful[0].kind !== "LParen")
    return aliases;
  if (meaningful[1].kind !== "Symbol" || meaningful[1].value !== "ns")
    return aliases;
  let i = 3;
  let depth = 1;
  while (i < meaningful.length && depth > 0) {
    const tok = meaningful[i];
    if (tok.kind === "LParen") {
      depth++;
      i++;
      continue;
    }
    if (tok.kind === "RParen") {
      depth--;
      i++;
      continue;
    }
    if (tok.kind === "LBracket") {
      let j = i + 1;
      let nsSym = null;
      while (j < meaningful.length && meaningful[j].kind !== "RBracket") {
        const t = meaningful[j];
        if (t.kind === "Symbol" && nsSym === null) {
          nsSym = t.value;
        }
        if (t.kind === "Keyword" && (t.value === ":as" || t.value === ":as-alias")) {
          j++;
          if (j < meaningful.length && meaningful[j].kind === "Symbol" && nsSym) {
            aliases.set(meaningful[j].value, nsSym);
          }
        }
        j++;
      }
    }
    i++;
  }
  return aliases;
}
function findNsForm(forms) {
  const nsForm = forms.find((f) => isList(f) && isSymbol(f.value[0]) && f.value[0].name === "ns");
  if (!nsForm || !isList(nsForm))
    return null;
  return nsForm;
}
function extractRequireClauses(forms) {
  const nsForm = findNsForm(forms);
  if (!nsForm)
    return [];
  const clauses = [];
  for (let i = 2;i < nsForm.value.length; i++) {
    const clause = nsForm.value[i];
    if (isList(clause) && isKeyword(clause.value[0]) && clause.value[0].name === ":require") {
      clauses.push(clause.value.slice(1));
    }
  }
  return clauses;
}
function processRequireSpec(spec, currentEnv, registry, resolveNamespace) {
  if (!isVector(spec)) {
    throw new EvaluationError("require spec must be a vector, e.g. [my.ns :as alias]", { spec });
  }
  const elements = spec.value;
  if (elements.length === 0 || !isSymbol(elements[0])) {
    throw new EvaluationError("First element of require spec must be a namespace symbol", { spec });
  }
  const nsName = elements[0].name;
  const hasAsAlias = elements.some((el) => isKeyword(el) && el.name === ":as-alias");
  if (hasAsAlias) {
    let i2 = 1;
    while (i2 < elements.length) {
      const kw = elements[i2];
      if (!isKeyword(kw)) {
        throw new EvaluationError(`Expected keyword in require spec, got ${kw.kind}`, { spec, position: i2 });
      }
      if (kw.name === ":as-alias") {
        i2++;
        const alias = elements[i2];
        if (!alias || !isSymbol(alias)) {
          throw new EvaluationError(":as-alias expects a symbol alias", {
            spec,
            position: i2
          });
        }
        currentEnv.ns.readerAliases.set(alias.name, nsName);
        i2++;
      } else {
        throw new EvaluationError(`:as-alias specs only support :as-alias, got ${kw.name}`, { spec });
      }
    }
    return;
  }
  let targetEnv = registry.get(nsName);
  if (!targetEnv && resolveNamespace) {
    resolveNamespace(nsName);
    targetEnv = registry.get(nsName);
  }
  if (!targetEnv) {
    throw new EvaluationError(`Namespace ${nsName} not found. Only already-loaded namespaces can be required.`, { nsName });
  }
  let i = 1;
  while (i < elements.length) {
    const kw = elements[i];
    if (!isKeyword(kw)) {
      throw new EvaluationError(`Expected keyword in require spec, got ${kw.kind}`, { spec, position: i });
    }
    if (kw.name === ":as") {
      i++;
      const alias = elements[i];
      if (!alias || !isSymbol(alias)) {
        throw new EvaluationError(":as expects a symbol alias", {
          spec,
          position: i
        });
      }
      currentEnv.ns.aliases.set(alias.name, targetEnv.ns);
      i++;
    } else if (kw.name === ":refer") {
      i++;
      const symsVec = elements[i];
      if (!symsVec || !isVector(symsVec)) {
        throw new EvaluationError(":refer expects a vector of symbols", {
          spec,
          position: i
        });
      }
      for (const sym of symsVec.value) {
        if (!isSymbol(sym)) {
          throw new EvaluationError(":refer vector must contain only symbols", {
            spec,
            sym
          });
        }
        const v = lookupVar(sym.name, targetEnv);
        if (v !== undefined) {
          currentEnv.ns.vars.set(sym.name, v);
        } else {
          let value;
          try {
            value = lookup(sym.name, targetEnv);
          } catch {
            throw new EvaluationError(`Symbol ${sym.name} not found in namespace ${nsName}`, { nsName, symbol: sym.name });
          }
          define(sym.name, value, currentEnv);
        }
      }
      i++;
    } else {
      throw new EvaluationError(`Unknown require option ${kw.name}. Supported: :as, :refer`, { spec, keyword: kw.name });
    }
  }
}
function buildSessionApi(state, options) {
  const registry = state.registry;
  let currentNs = state.currentNs;
  const coreEnv = registry.get("clojure.core");
  coreEnv.resolveNs = (name) => registry.get(name) ?? null;
  const emitFn = options?.output ?? ((text) => console.log(text));
  internVar("println", cljNativeFunction("println", (...args) => {
    emitFn(args.map(valueToString).join(" ") + `
`);
    return cljNil();
  }), coreEnv);
  internVar("print", cljNativeFunction("print", (...args) => {
    emitFn(args.map(valueToString).join(" "));
    return cljNil();
  }), coreEnv);
  internVar("newline", cljNativeFunction("newline", () => {
    emitFn(`
`);
    return cljNil();
  }), coreEnv);
  const sourceRoots = new Set(options?.sourceRoots ?? []);
  function addSourceRoot(path) {
    sourceRoots.add(path);
  }
  const ctx = createEvaluationContext();
  function resolveNamespace(nsName) {
    const builtInLoader = builtInNamespaceSources[nsName];
    if (builtInLoader) {
      loadFile(builtInLoader(), nsName);
      return true;
    }
    if (!options?.readFile || sourceRoots.size === 0) {
      return false;
    }
    for (const root of sourceRoots) {
      const filePath = `${root.replace(/\/$/, "")}/${nsName.replace(/\./g, "/")}.clj`;
      try {
        const source = options.readFile(filePath);
        if (source) {
          loadFile(source);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }
  function ensureNs(name) {
    if (!registry.has(name)) {
      const nsEnv = makeEnv(coreEnv);
      nsEnv.ns = makeNamespace(name);
      registry.set(name, nsEnv);
    }
    return registry.get(name);
  }
  function setNs(name) {
    ensureNs(name);
    currentNs = name;
  }
  function getNs(name) {
    return registry.get(name)?.ns ?? null;
  }
  function getNsEnv(name) {
    return registry.get(name) ?? null;
  }
  internVar("require", cljNativeFunction("require", (...args) => {
    const currentEnv = registry.get(currentNs);
    for (const arg of args) {
      processRequireSpec(arg, currentEnv, registry, resolveNamespace);
    }
    return cljNil();
  }), coreEnv);
  internVar("resolve", cljNativeFunction("resolve", (sym) => {
    if (!isSymbol(sym))
      return cljNil();
    const slashIdx = sym.name.indexOf("/");
    if (slashIdx > 0) {
      const nsName = sym.name.slice(0, slashIdx);
      const symName = sym.name.slice(slashIdx + 1);
      const nsEnv = registry.get(nsName) ?? null;
      if (!nsEnv)
        return cljNil();
      return tryLookup(symName, nsEnv) ?? cljNil();
    }
    const currentEnv = registry.get(currentNs);
    return tryLookup(sym.name, currentEnv) ?? cljNil();
  }), coreEnv);
  function processNsRequires(forms, env) {
    const requireClauses = extractRequireClauses(forms);
    for (const specs of requireClauses) {
      for (const spec of specs) {
        processRequireSpec(spec, env, registry, resolveNamespace);
      }
    }
  }
  function loadFile(source, nsName, filePath) {
    const tokens = tokenize(source);
    const targetNs = extractNsNameFromTokens(tokens) ?? nsName ?? "user";
    const aliasMap = extractAliasMapFromTokens(tokens);
    const forms = readForms(tokens, targetNs, aliasMap);
    const env = ensureNs(targetNs);
    ctx.currentSource = source;
    ctx.currentFile = filePath;
    ctx.currentLineOffset = 0;
    ctx.currentColOffset = 0;
    processNsRequires(forms, env);
    try {
      for (const form of forms) {
        const expanded = ctx.expandAll(form, env);
        ctx.evaluate(expanded, env);
      }
    } finally {
      ctx.currentSource = undefined;
      ctx.currentFile = undefined;
    }
    return targetNs;
  }
  const api = {
    registry,
    get currentNs() {
      return currentNs;
    },
    setNs,
    getNs,
    loadFile,
    addSourceRoot,
    evaluate(source, opts) {
      ctx.currentSource = source;
      ctx.currentFile = opts?.file;
      ctx.currentLineOffset = opts?.lineOffset ?? 0;
      ctx.currentColOffset = opts?.colOffset ?? 0;
      try {
        const tokens = tokenize(source);
        const declaredNs = extractNsNameFromTokens(tokens);
        if (declaredNs) {
          ensureNs(declaredNs);
          currentNs = declaredNs;
        }
        const env = getNsEnv(currentNs);
        const aliasMap = extractAliasMapFromTokens(tokens);
        env.ns?.aliases.forEach((ns, alias) => {
          aliasMap.set(alias, ns.name);
        });
        env.ns?.readerAliases.forEach((nsName, alias) => {
          aliasMap.set(alias, nsName);
        });
        const forms = readForms(tokens, currentNs, aliasMap);
        processNsRequires(forms, env);
        let result = cljNil();
        for (const form of forms) {
          const expanded = ctx.expandAll(form, env);
          result = ctx.evaluate(expanded, env);
        }
        return result;
      } catch (e) {
        if (e instanceof CljThrownSignal) {
          throw new EvaluationError(`Unhandled throw: ${printString(e.value)}`, { thrownValue: e.value });
        }
        if (e instanceof RecurSignal) {
          throw new EvaluationError("recur called outside of loop or fn", {
            args: e.args
          });
        }
        if ((e instanceof EvaluationError || e instanceof ReaderError) && e.pos) {
          e.message += formatErrorContext(source, e.pos, {
            lineOffset: ctx.currentLineOffset,
            colOffset: ctx.currentColOffset
          });
        }
        throw e;
      } finally {
        ctx.currentSource = undefined;
        ctx.currentFile = undefined;
      }
    },
    evaluateForms(forms) {
      try {
        const env = getNsEnv(currentNs);
        let result = cljNil();
        for (const form of forms) {
          const expanded = ctx.expandAll(form, env);
          result = ctx.evaluate(expanded, env);
        }
        return result;
      } catch (e) {
        if (e instanceof CljThrownSignal) {
          throw new EvaluationError(`Unhandled throw: ${printString(e.value)}`, { thrownValue: e.value });
        }
        if (e instanceof RecurSignal) {
          throw new EvaluationError("recur called outside of loop or fn", {
            args: e.args
          });
        }
        throw e;
      }
    },
    getCompletions(prefix, nsName) {
      let env = registry.get(nsName ?? currentNs) ?? null;
      const seen = new Set;
      while (env) {
        for (const key of env.bindings.keys())
          seen.add(key);
        if (env.ns)
          for (const key of env.ns.vars.keys())
            seen.add(key);
        env = env.outer;
      }
      const candidates = [...seen];
      if (!prefix)
        return candidates.sort();
      return candidates.filter((k) => k.startsWith(prefix)).sort();
    }
  };
  return api;
}
function createSession(options) {
  const registry = new Map;
  const coreEnv = makeEnv();
  coreEnv.ns = makeNamespace("clojure.core");
  loadCoreFunctions(coreEnv, options?.output);
  registry.set("clojure.core", coreEnv);
  const userEnv = makeEnv(coreEnv);
  userEnv.ns = makeNamespace("user");
  registry.set("user", userEnv);
  const session = buildSessionApi({ registry, currentNs: "user" }, options);
  const coreLoader = builtInNamespaceSources["clojure.core"];
  if (!coreLoader) {
    throw new Error("Missing built-in clojure.core source in registry");
  }
  session.loadFile(coreLoader(), "clojure.core");
  for (const source of options?.entries ?? []) {
    session.loadFile(source);
  }
  return session;
}

// src/vite-plugin-clj/namespace-utils.ts
function pathToNs(filePath, sourceRoots) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const root of sourceRoots) {
    const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "") + "/";
    if (normalized.startsWith(normalizedRoot)) {
      return normalized.slice(normalizedRoot.length).replace(/\.clj$/, "").replace(/\//g, ".");
    }
  }
  throw new Error(`File ${filePath} is not under any configured source root: ${sourceRoots.join(", ")}`);
}
function nsToPath(nsName, sourceRoot) {
  const root = sourceRoot.replace(/\/$/, "");
  return `${root}/${nsName.replace(/\./g, "/")}.clj`;
}
function extractNsRequires(source) {
  const forms = readForms(tokenize(source));
  const nsForm = forms.find((f) => isList(f) && isSymbol(f.value[0]) && f.value[0].name === "ns");
  if (!nsForm || !isList(nsForm))
    return [];
  const requires = [];
  for (let i = 2;i < nsForm.value.length; i++) {
    const clause = nsForm.value[i];
    if (isList(clause) && isKeyword(clause.value[0]) && clause.value[0].name === ":require") {
      for (let j = 1;j < clause.value.length; j++) {
        const spec = clause.value[j];
        if (isVector(spec) && spec.value.length > 0 && isSymbol(spec.value[0])) {
          requires.push(spec.value[0].name);
        }
      }
    }
  }
  return requires;
}
function extractNsName(source) {
  const forms = readForms(tokenize(source));
  const nsForm = forms.find((f) => isList(f) && isSymbol(f.value[0]) && f.value[0].name === "ns");
  if (!nsForm)
    return null;
  const nameSymbol = nsForm.value[1];
  return isSymbol(nameSymbol) ? nameSymbol.name : null;
}

// src/vite-plugin-clj/codegen.ts
function generateModuleCode(ctx, nsNameFromPath, source) {
  const nsName = extractNsName(source) ?? nsNameFromPath;
  ctx.session.loadFile(source, nsName);
  const requires = extractNsRequires(source);
  const depImports = requires.map((depNs) => {
    const depPath = ctx.resolveDepPath(depNs);
    if (depPath)
      return `import ${JSON.stringify(depPath)};`;
    return null;
  }).filter(Boolean).join(`
`);
  const nsData = ctx.session.getNs(nsName);
  if (!nsData) {
    return `throw new Error('Namespace ${nsName} failed to load');`;
  }
  const exportLines = [];
  for (const [name, v] of nsData.vars) {
    const value = v.value;
    if (isMacro(value))
      continue;
    const safeName = safeJsIdentifier(name);
    const deref2 = `__ns.vars.get(${JSON.stringify(name)}).value`;
    if (isAFunction2(value)) {
      exportLines.push(`export function ${safeName}(...args) {` + `  const fn = ${deref2};` + `  const cljArgs = args.map(jsToClj);` + `  const result = applyFunction(fn, cljArgs);` + `  return cljToJs(result);` + `}`);
    } else {
      exportLines.push(`export const ${safeName} = cljToJs(${deref2});`);
    }
  }
  const escapedSource = JSON.stringify(source);
  return [
    `import { getSession } from ${JSON.stringify(ctx.virtualSessionId)};`,
    `import { cljToJs, jsToClj, applyFunction } from ${JSON.stringify(ctx.coreIndexPath)};`,
    depImports,
    ``,
    `const __session = getSession();`,
    `__session.loadFile(${escapedSource}, ${JSON.stringify(nsName)});`,
    `const __ns = __session.getNs(${JSON.stringify(nsName)});`,
    ``,
    ...exportLines,
    ``,
    `// Self-accept HMR: re-execute this module on save (updates browser session)`,
    `// without propagating to parent modules — prevents full page reload.`,
    `if (import.meta.hot) { import.meta.hot.accept() }`
  ].join(`
`);
}
function isAFunction2(value) {
  return value.kind === "function" || value.kind === "native-function";
}
function cljValueToTsType(value) {
  switch (value.kind) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "nil":
      return "null";
    case "keyword":
      return "string";
    case "symbol":
      return "string";
    case "list":
    case "vector":
      return "unknown[]";
    case "map":
      return "Record<string, unknown>";
    case "function":
    case "native-function":
      return "(...args: unknown[]) => unknown";
    case "macro":
      return "never";
    case "var":
      return "unknown";
    default:
      throw new Error(`Unknown CljValue kind: ${value.kind}`);
  }
}
function patternName(p, index) {
  if (p.kind === "symbol")
    return safeJsIdentifier(p.name);
  return `arg${index}`;
}
function arityToSignature(arity) {
  const fixedParams = arity.params.map((p, i) => `${patternName(p, i)}: unknown`).join(", ");
  if (arity.restParam) {
    const restName = arity.restParam.kind === "symbol" ? safeJsIdentifier(arity.restParam.name) : "rest";
    const params = fixedParams ? `${fixedParams}, ...${restName}: unknown[]` : `...${restName}: unknown[]`;
    return `(${params}): unknown`;
  }
  return `(${fixedParams}): unknown`;
}
function generateDts(ctx, nsNameFromPath, source) {
  const nsName = extractNsName(source) ?? nsNameFromPath;
  try {
    ctx.session.loadFile(source, nsName);
  } catch {
    return "";
  }
  const nsData = ctx.session.getNs(nsName);
  if (!nsData)
    return "";
  const declarations = [];
  for (const [name, v] of nsData.vars) {
    const value = v.value;
    if (isMacro(value))
      continue;
    const safeName = safeJsIdentifier(name);
    if (value.kind === "function") {
      for (const arity of value.arities) {
        declarations.push(`export function ${safeName}${arityToSignature(arity)};`);
      }
    } else if (value.kind === "native-function") {
      declarations.push(`export function ${safeName}(...args: unknown[]): unknown;`);
    } else {
      declarations.push(`export const ${safeName}: ${cljValueToTsType(value)};`);
    }
  }
  return declarations.join(`
`);
}
var JS_RESERVED_WORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "enum",
  "await"
]);
function safeJsIdentifier(name) {
  const transformed = name.replace(/(?<=[a-zA-Z0-9])-(?=[a-zA-Z0-9])/g, "_").replace(/-/g, "_MINUS_").replace(/\//g, "_DIV_").replace(/\?/g, "_QMARK_").replace(/!/g, "_BANG_").replace(/\*/g, "_STAR_").replace(/\+/g, "_PLUS_").replace(/>/g, "_GT_").replace(/</g, "_LT_").replace(/=/g, "_EQ_").replace(/\./g, "_DOT_").replace(/'/g, "_QUOTE_");
  return JS_RESERVED_WORDS.has(transformed) ? `$${transformed}` : transformed;
}

// src/vite-plugin-clj/nrepl-relay.ts
import * as net from "node:net";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

// src/bin/bencode.ts
import * as stream from "stream";
import { Buffer } from "buffer";
var bencode = (value) => {
  if (value === null || value === undefined) {
    value = 0;
  }
  if (typeof value == "boolean") {
    value = value ? 1 : 0;
  }
  if (typeof value == "number") {
    return "i" + value + "e";
  }
  if (typeof value == "string") {
    return Buffer.byteLength(value, "utf8") + ":" + value;
  }
  if (value instanceof Array) {
    return "l" + value.map(bencode).join("") + "e";
  }
  let out = "d";
  for (const prop in value) {
    out += bencode(prop) + bencode(value[prop]);
  }
  return out + "e";
};

class BEncoderStream extends stream.Transform {
  data = [];
  constructor() {
    super({ objectMode: true });
  }
  _transform(object, _encoding, cb) {
    const enc = bencode(object);
    this.push(enc);
    cb();
  }
}

class BIncrementalDecoder {
  state = { id: "ready" };
  stack = [];
  complete(data) {
    if (this.stack.length) {
      this.state = this.stack.pop();
      if (this.state.id == "list") {
        this.state.accum.push(data);
        this.stack.push(this.state);
        this.state = { id: "ready" };
      } else if (this.state.id == "dict") {
        if (this.state.key !== null) {
          this.state.accum[this.state.key] = data;
          this.state.key = null;
        } else {
          this.state.key = data;
        }
        this.stack.push(this.state);
        this.state = { id: "ready" };
      }
    } else {
      this.state = { id: "ready" };
      return data;
    }
  }
  write(byte) {
    const ch = String.fromCharCode(byte);
    if (this.state.id == "ready") {
      switch (ch) {
        case "i":
          this.state = { id: "int", accum: "" };
          break;
        case "d":
          this.stack.push({ id: "dict", accum: {}, key: null });
          break;
        case "l":
          this.stack.push({ id: "list", accum: [] });
          break;
        case "e":
          if (!this.stack.length) {
            throw "unexpected end";
          }
          this.state = this.stack.pop();
          if (this.state.id == "dict") {
            if (this.state.key !== null) {
              throw "Missing value in dict";
            }
            return this.complete(this.state.accum);
          } else if (this.state.id == "list") {
            return this.complete(this.state.accum);
          }
          break;
        default:
          if (ch >= "0" && ch <= "9") {
            this.state = { id: "string-start", accum: ch };
          } else {
            throw "Malformed input in bencode";
          }
      }
    } else if (this.state.id == "int") {
      if (ch == "e") {
        return this.complete(parseInt(this.state.accum));
      } else {
        this.state.accum += ch;
      }
    } else if (this.state.id == "string-start") {
      if (ch == ":") {
        if (!isFinite(+this.state.accum)) {
          throw new Error("Invalid string length: " + this.state.accum);
        }
        if (+this.state.accum == 0) {
          return this.complete("");
        }
        this.state = {
          id: "string-body",
          accum: [],
          length: +this.state.accum
        };
      } else {
        this.state.accum += ch;
      }
    } else if (this.state.id == "string-body") {
      this.state.accum.push(byte);
      if (this.state.accum.length >= this.state.length) {
        return this.complete(Buffer.from(this.state.accum).toString("utf8"));
      }
    } else if (this.state.id == "list") {
      return this.complete(this.state.accum);
    } else if (this.state.id == "dict") {
      return this.complete(this.state.accum);
    } else {
      throw "Junk in bencode";
    }
  }
}

class BDecoderStream extends stream.Transform {
  decoder = new BIncrementalDecoder;
  constructor() {
    super({ objectMode: true });
  }
  _transform(data, _encoding, cb) {
    for (let i = 0;i < data.length; i++) {
      const res = this.decoder.write(data[i]);
      if (res) {
        this.push(res);
      }
    }
    cb();
  }
}

// src/bin/version.ts
var VERSION = "0.0.10";

// src/vite-plugin-clj/nrepl-relay.ts
function makeId() {
  return crypto.randomUUID();
}
function send(encoder, msg) {
  encoder.write(msg);
}
function done(encoder, id, sessionId, extra = {}) {
  send(encoder, {
    id,
    ...sessionId ? { session: sessionId } : {},
    status: ["done"],
    ...extra
  });
}
async function forwardToB(event, data, ws, pending, timeoutMs = 15000) {
  const correlationId = makeId();
  if (ws.clients.size === 0) {
    return { id: correlationId, error: "No browser tab connected to Vite dev server" };
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(correlationId)) {
        pending.delete(correlationId);
        resolve({ id: correlationId, error: "Timed out — no response from browser (15s)" });
      }
    }, timeoutMs);
    pending.set(correlationId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    ws.send({ type: "custom", event, data: { ...data, id: correlationId } });
  });
}
function handleClone(msg, sessions, encoder) {
  const id = msg["id"] ?? "";
  const newId = makeId();
  sessions.set(newId, { id: newId, currentNs: "user" });
  done(encoder, id, undefined, { "new-session": newId });
}
function handleDescribe(msg, encoder) {
  const id = msg["id"] ?? "";
  const sessionId = msg["session"];
  done(encoder, id, sessionId, {
    ops: {
      eval: {},
      clone: {},
      close: {},
      complete: {},
      describe: {},
      eldoc: {},
      info: {},
      lookup: {},
      "load-file": {}
    },
    versions: { conjure: { "version-string": VERSION } }
  });
}
function handleComplete(msg, session, encoder, serverSession) {
  const id = msg["id"] ?? "";
  const prefix = msg["prefix"] ?? "";
  const nsName = msg["ns"] ?? session.currentNs;
  const names = serverSession.getCompletions(prefix, nsName);
  const completions = names.map((c) => ({
    candidate: c,
    type: "var",
    ns: session.currentNs
  }));
  done(encoder, id, session.id, { completions });
}
function handleClose(msg, sessions, encoder) {
  const id = msg["id"] ?? "";
  const sessionId = msg["session"] ?? "";
  sessions.delete(sessionId);
  send(encoder, { id, session: sessionId, status: ["done"] });
}
function handleUnknown(msg, encoder) {
  const id = msg["id"] ?? "";
  send(encoder, { id, status: ["unknown-op", "done"] });
}
async function handleEval(msg, session, encoder, ws, pending) {
  const id = msg["id"] ?? "";
  const code = msg["code"] ?? "";
  const result = await forwardToB("conjure:eval", { code, ns: session.currentNs }, ws, pending);
  if (result.ns)
    session.currentNs = result.ns;
  if (result.out)
    send(encoder, { id, session: session.id, out: result.out });
  if (result.error) {
    done(encoder, id, session.id, {
      ex: result.error,
      err: result.error + `
`,
      ns: session.currentNs,
      status: ["eval-error", "done"]
    });
  } else {
    done(encoder, id, session.id, { value: result.value ?? "nil", ns: session.currentNs });
  }
}
async function handleLoadFile(msg, session, encoder, ws, pending) {
  const id = msg["id"] ?? "";
  const source = msg["file"] ?? "";
  const fileName = msg["file-name"] ?? "";
  const filePath = msg["file-path"] ?? "";
  const nsHint = fileName.replace(/\.clj$/, "").replace(/\//g, ".") || undefined;
  const result = await forwardToB("conjure:load-file", { source, nsHint, filePath }, ws, pending);
  if (result.ns)
    session.currentNs = result.ns;
  if (result.out)
    send(encoder, { id, session: session.id, out: result.out });
  if (result.error) {
    done(encoder, id, session.id, {
      ex: result.error,
      err: result.error + `
`,
      ns: session.currentNs,
      status: ["eval-error", "done"]
    });
  } else {
    done(encoder, id, session.id, { value: result.value ?? "nil", ns: session.currentNs });
  }
}
async function handleMessage(msg, sessions, defaultSession, encoder, ws, pending, serverSession) {
  const op = msg["op"];
  const sessionId = msg["session"];
  const session = sessionId ? sessions.get(sessionId) ?? defaultSession : defaultSession;
  switch (op) {
    case "clone":
      handleClone(msg, sessions, encoder);
      break;
    case "describe":
      handleDescribe(msg, encoder);
      break;
    case "eval":
      await handleEval(msg, session, encoder, ws, pending);
      break;
    case "load-file":
      await handleLoadFile(msg, session, encoder, ws, pending);
      break;
    case "complete":
      handleComplete(msg, session, encoder, serverSession);
      break;
    case "close":
      handleClose(msg, sessions, encoder);
      break;
    case "info":
    case "lookup":
      send(encoder, {
        id: msg["id"] ?? "",
        session: session.id,
        status: ["no-info", "done"]
      });
      break;
    case "eldoc":
      send(encoder, {
        id: msg["id"] ?? "",
        session: session.id,
        status: ["no-eldoc", "done"]
      });
      break;
    default:
      handleUnknown(msg, encoder);
  }
}
function startBrowserNreplRelay(options) {
  const port = options.port ?? 7888;
  const host = options.host ?? "127.0.0.1";
  const { ws, serverSession, cwd } = options;
  const pending = new Map;
  ws.on("conjure:eval-result", (data) => {
    const resolve = pending.get(data.id);
    if (resolve) {
      pending.delete(data.id);
      resolve(data);
    }
  });
  ws.on("conjure:load-file-result", (data) => {
    const resolve = pending.get(data.id);
    if (resolve) {
      pending.delete(data.id);
      resolve(data);
    }
  });
  const server = net.createServer((socket) => {
    const encoder = new BEncoderStream;
    const decoder = new BDecoderStream;
    encoder.pipe(socket);
    socket.pipe(decoder);
    const sessions = new Map;
    const defaultId = makeId();
    const defaultSession = { id: defaultId, currentNs: "user" };
    sessions.set(defaultId, defaultSession);
    decoder.on("data", (msg) => {
      handleMessage(msg, sessions, defaultSession, encoder, ws, pending, serverSession).catch((err) => {
        console.error("[conjure] relay error:", err);
      });
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      sessions.clear();
    });
  });
  const portFile = join(cwd, ".nrepl-port");
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[conjure] Port ${port} already in use — browser nREPL relay not started. ` + `Kill the process holding the port or set a different nreplPort.`);
    } else {
      console.error("[conjure] nREPL relay error:", err.message);
    }
  });
  server.listen(port, host, () => {
    writeFileSync(portFile, String(port), "utf8");
    console.log(`[conjure] Browser nREPL relay started on port ${port}`);
  });
  const cleanup = () => {
    if (existsSync(portFile))
      unlinkSync(portFile);
  };
  server.on("close", cleanup);
  return server;
}

// src/vite-plugin-clj/index.ts
function resolveCoreIndexPath() {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const fromSource = resolve(thisDir, "../core/index.ts");
  try {
    statSync(fromSource);
    return fromSource;
  } catch {
    return resolve(thisDir, "../src/core/index.ts");
  }
}
var VIRTUAL_SESSION_ID = "virtual:clj-session";
var RESOLVED_VIRTUAL_SESSION_ID = "\x00" + VIRTUAL_SESSION_ID;
function cljPlugin(options) {
  const sourceRoots = options?.sourceRoots ?? ["src"];
  let projectRoot = "";
  let serverSession;
  let coreIndexPath;
  let codegenCtx;
  let generatorScriptPath;
  let serveMode = false;
  function writeFileIfChanged(path, content) {
    try {
      const existing = readFileSync(path, "utf-8");
      if (existing === content) {
        return;
      }
    } catch {}
    writeFileSync2(path, content, "utf-8");
  }
  function collectCljFiles(dir) {
    let results = [];
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules")
        continue;
      const fullPath = join2(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(collectCljFiles(fullPath));
        } else if (entry.endsWith(".clj")) {
          results.push(fullPath);
        }
      } catch {
        continue;
      }
    }
    return results;
  }
  function eagerlyGenerateDts() {
    for (const root of sourceRoots) {
      const rootPath = resolve(projectRoot, root);
      for (const filePath of collectCljFiles(rootPath)) {
        try {
          const source = readFileSync(filePath, "utf-8");
          const nsNameFromPath = pathToNs(relative(projectRoot, filePath), sourceRoots);
          const dts = generateDts(codegenCtx, nsNameFromPath, source);
          writeFileIfChanged(filePath + ".d.ts", dts);
        } catch {
          continue;
        }
      }
    }
  }
  function initServerSession() {
    serverSession = createSession({
      sourceRoots,
      readFile: (filePath) => readFileSync(resolve(projectRoot, filePath), "utf-8"),
      output: () => {}
    });
    codegenCtx = {
      session: serverSession,
      sourceRoots,
      coreIndexPath,
      virtualSessionId: VIRTUAL_SESSION_ID,
      resolveDepPath: (depNs) => {
        for (const root of sourceRoots) {
          const depPath = resolve(projectRoot, nsToPath(depNs, root));
          try {
            readFileSync(depPath);
            return depPath;
          } catch {
            continue;
          }
        }
        return null;
      }
    };
  }
  function regenerateBuiltInNamespaceSources() {
    try {
      statSync(generatorScriptPath);
    } catch {
      return;
    }
    try {
      execFileSync(process.execPath, [generatorScriptPath], {
        cwd: projectRoot,
        stdio: "pipe"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate built-in namespace sources: ${message}`);
    }
  }
  return {
    name: "vite-plugin-clj",
    configResolved(config) {
      projectRoot = config.root;
      serveMode = config.command === "serve";
      generatorScriptPath = resolve(projectRoot, "scripts/gen-core-source.mjs");
      regenerateBuiltInNamespaceSources();
      coreIndexPath = resolveCoreIndexPath();
      initServerSession();
      eagerlyGenerateDts();
    },
    configureServer(server) {
      startBrowserNreplRelay({
        port: options?.nreplPort,
        cwd: projectRoot,
        ws: server.ws,
        serverSession
      });
    },
    resolveId(source) {
      if (source === VIRTUAL_SESSION_ID) {
        return RESOLVED_VIRTUAL_SESSION_ID;
      }
      if (source.endsWith(".clj") && !source.includes("?")) {
        return null;
      }
      return;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_SESSION_ID) {
        const lines = [
          `import { createSession, printString } from ${JSON.stringify(coreIndexPath)};`,
          ``,
          `let _session = null;`,
          `let _outputLines = [];`,
          `export function getSession() {`,
          `  if (!_session) {`,
          `    _session = createSession({ output: (text) => { _outputLines.push(text); console.log(text.replace(/\\n$/, '')); } });`,
          `  }`,
          `  return _session;`,
          `}`
        ];
        if (serveMode) {
          lines.push(``, `// Browser nREPL relay — active only in Vite dev server`, `if (import.meta.hot) {`, `  import.meta.hot.on('conjure:eval', ({ id, code, ns }) => {`, `    const session = getSession();`, `    _outputLines = [];`, `    try {`, `      if (ns && ns !== session.currentNs) session.setNs(ns);`, `      const result = session.evaluate(code);`, `      const out = _outputLines.join('');`, `      import.meta.hot.send('conjure:eval-result', { id, value: printString(result), ns: session.currentNs, ...(out ? { out } : {}) });`, `    } catch (err) {`, `      console.error(err);`, `      const out = _outputLines.join('');`, `      import.meta.hot.send('conjure:eval-result', { id, error: err instanceof Error ? err.message : String(err), ns: session.currentNs, ...(out ? { out } : {}) });`, `    }`, `  });`, ``, `  import.meta.hot.on('conjure:load-file', ({ id, source, nsHint, filePath }) => {`, `    const session = getSession();`, `    _outputLines = [];`, `    try {`, `      const loadedNs = session.loadFile(source, nsHint, filePath || undefined);`, `      if (loadedNs) session.setNs(loadedNs);`, `      const out = _outputLines.join('');`, `      import.meta.hot.send('conjure:load-file-result', { id, value: 'nil', ns: session.currentNs, ...(out ? { out } : {}) });`, `    } catch (err) {`, `      console.error(err);`, `      const out = _outputLines.join('');`, `      import.meta.hot.send('conjure:load-file-result', { id, error: err instanceof Error ? err.message : String(err), ns: session.currentNs, ...(out ? { out } : {}) });`, `    }`, `  });`, `}`);
        }
        return lines.join(`
`);
      }
      if (id.endsWith(".clj") && !id.includes("?")) {
        const source = readFileSync(id, "utf-8");
        const nsNameFromPath = pathToNs(relative(projectRoot, id), sourceRoots);
        const code = generateModuleCode(codegenCtx, nsNameFromPath, source);
        const dts = generateDts(codegenCtx, nsNameFromPath, source);
        writeFileIfChanged(id + ".d.ts", dts);
        return code;
      }
    },
    hotUpdate({ file, modules, read }) {
      if (!file.endsWith(".clj"))
        return;
      const doUpdate = async () => {
        if (file.startsWith(resolve(projectRoot, "src/clojure") + "/")) {
          regenerateBuiltInNamespaceSources();
        }
        const source = await read();
        try {
          const nsNameFromPath = pathToNs(relative(projectRoot, file), sourceRoots);
          serverSession.loadFile(source, nsNameFromPath);
          const dts = generateDts(codegenCtx, nsNameFromPath, source);
          writeFileIfChanged(file + ".d.ts", dts);
        } catch {}
        return modules;
      };
      return doUpdate();
    }
  };
}
export {
  safeJsIdentifier,
  generateModuleCode,
  generateDts,
  cljPlugin
};
