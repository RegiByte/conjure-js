import { isAtom, isAFunction, isEqual, isReduced, isVolatile, isFalsy } from '../assertions'
import { EvaluationError } from '../errors'
import {
  cljAtom,
  cljBoolean,
  cljNativeFunctionWithContext,
  cljNativeFunction,
  cljNil,
  cljVector,
  withDoc,
} from '../factories'
import { printString } from '../printer'
import type { CljAtom, CljFunction, CljNativeFunction, CljValue, Env } from '../types'

function validateAtom(a: CljAtom, newVal: CljValue, ctx: import('../types').EvaluationContext, callEnv: Env) {
  if (a.validator && isAFunction(a.validator)) {
    const result = ctx.applyFunction(a.validator, [newVal], callEnv)
    if (isFalsy(result)) {
      throw new EvaluationError('Invalid reference state', { newVal })
    }
  }
}

function notifyWatches(a: CljAtom, oldVal: CljValue, newVal: CljValue) {
  if (a.watches) {
    for (const [, { key, fn, ctx, callEnv }] of a.watches) {
      ctx.applyFunction(fn as CljFunction | CljNativeFunction, [key, { kind: 'atom', value: newVal } as CljValue, oldVal, newVal], callEnv)
    }
  }
}

export const atomFunctions: Record<string, CljValue> = {
  atom: withDoc(
    cljNativeFunction('atom', function atom(value: CljValue) {
      return cljAtom(value)
    }),
    'Returns a new atom holding the given value.',
    [['value']]
  ),

  deref: withDoc(
    cljNativeFunction('deref', function deref(value: CljValue) {
      if (isAtom(value)) return value.value
      if (isVolatile(value)) return value.value
      if (isReduced(value)) return value.value
      throw EvaluationError.atArg(`deref expects an atom, volatile, or reduced value, got ${value.kind}`, { value }, 0)
    }),
    'Returns the wrapped value from an atom, volatile, or reduced value.',
    [['value']]
  ),

  'swap!': withDoc(
    cljNativeFunctionWithContext(
      'swap!',
      function swap(
        ctx,
        callEnv: Env,
        atomVal: CljValue,
        fn: CljValue,
        ...extraArgs: CljValue[]
      ) {
        if (!isAtom(atomVal)) {
          throw EvaluationError.atArg(`swap! expects an atom as its first argument, got ${atomVal.kind}`, { atomVal }, 0)
        }
        if (!isAFunction(fn)) {
          throw EvaluationError.atArg(`swap! expects a function as its second argument, got ${fn.kind}`, { fn }, 1)
        }
        const a = atomVal as CljAtom
        const oldVal = a.value
        const newVal = ctx.applyFunction(fn, [oldVal, ...extraArgs], callEnv)
        validateAtom(a, newVal, ctx, callEnv)
        a.value = newVal
        notifyWatches(a, oldVal, newVal)
        return newVal
      }
    ),
    'Applies fn to the current value of the atom, replacing the current value with the result. Returns the new value.',
    [['atomVal', 'fn', '&', 'extraArgs']]
  ),

  'reset!': withDoc(
    cljNativeFunctionWithContext(
      'reset!',
      function reset(ctx, callEnv: Env, atomVal: CljValue, newVal: CljValue) {
        if (!isAtom(atomVal)) {
          throw EvaluationError.atArg(`reset! expects an atom as its first argument, got ${atomVal.kind}`, { atomVal }, 0)
        }
        const a = atomVal as CljAtom
        const oldVal = a.value
        validateAtom(a, newVal, ctx, callEnv)
        a.value = newVal
        notifyWatches(a, oldVal, newVal)
        return newVal
      }
    ),
    'Sets the value of the atom to newVal and returns the new value.',
    [['atomVal', 'newVal']]
  ),

  'atom?': withDoc(
    cljNativeFunction('atom?', function isAtomPredicate(value: CljValue) {
      return cljBoolean(isAtom(value))
    }),
    'Returns true if the value is an atom, false otherwise.',
    [['value']]
  ),

  'swap-vals!': withDoc(
    cljNativeFunctionWithContext(
      'swap-vals!',
      function swapVals(ctx, callEnv: Env, atomVal: CljValue, fn: CljValue, ...extraArgs: CljValue[]) {
        if (!isAtom(atomVal)) {
          throw EvaluationError.atArg(`swap-vals! expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
        }
        if (!isAFunction(fn)) {
          throw EvaluationError.atArg(`swap-vals! expects a function, got ${printString(fn)}`, { fn }, 1)
        }
        const oldVal = atomVal.value
        const newVal = ctx.applyFunction(fn, [oldVal, ...extraArgs], callEnv)
        atomVal.value = newVal
        return cljVector([oldVal, newVal])
      }
    ),
    'Atomically swaps the value of atom to be (apply f current-value-of-atom args). Returns [old new].',
    [['atom', 'f', '&', 'args']]
  ),

  'reset-vals!': withDoc(
    cljNativeFunction('reset-vals!', function resetVals(atomVal: CljValue, newVal: CljValue) {
      if (!isAtom(atomVal)) {
        throw EvaluationError.atArg(`reset-vals! expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
      }
      const oldVal = atomVal.value
      atomVal.value = newVal
      return cljVector([oldVal, newVal])
    }),
    'Sets the value of atom to newVal. Returns [old new].',
    [['atom', 'newval']]
  ),

  'compare-and-set!': withDoc(
    cljNativeFunction('compare-and-set!', function compareAndSet(atomVal: CljValue, oldv: CljValue, newv: CljValue) {
      if (!isAtom(atomVal)) {
        throw EvaluationError.atArg(`compare-and-set! expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
      }
      if (isEqual(atomVal.value, oldv)) {
        atomVal.value = newv
        return cljBoolean(true)
      }
      return cljBoolean(false)
    }),
    'Atomically sets the value of atom to newval if and only if the current value of the atom is identical to oldval. Returns true if set happened, else false.',
    [['atom', 'oldval', 'newval']]
  ),

  'add-watch': withDoc(
    cljNativeFunctionWithContext(
      'add-watch',
      function addWatch(ctx, callEnv: Env, atomVal: CljValue, key: CljValue, fn: CljValue) {
        if (!isAtom(atomVal)) {
          throw EvaluationError.atArg(`add-watch expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
        }
        if (!isAFunction(fn)) {
          throw EvaluationError.atArg(`add-watch expects a function, got ${printString(fn)}`, { fn }, 2)
        }
        const a = atomVal as CljAtom
        if (!a.watches) a.watches = new Map()
        // Store a wrapper that calls the user fn through the evaluator
        a.watches.set(printString(key), { key, fn, ctx, callEnv })
        return atomVal
      }
    ),
    'Adds a watch function to an atom. The watch fn must be a fn of 4 args: a key, the atom, its old-state, its new-state.',
    [['atom', 'key', 'fn']]
  ),

  'remove-watch': withDoc(
    cljNativeFunction('remove-watch', function removeWatch(atomVal: CljValue, key: CljValue) {
      if (!isAtom(atomVal)) {
        throw EvaluationError.atArg(`remove-watch expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
      }
      const a = atomVal as CljAtom
      if (a.watches) a.watches.delete(printString(key))
      return atomVal
    }),
    'Removes a watch (set by add-watch) from an atom.',
    [['atom', 'key']]
  ),

  'set-validator!': withDoc(
    cljNativeFunctionWithContext(
      'set-validator!',
      function setValidator(_ctx, _callEnv: Env, atomVal: CljValue, fn: CljValue) {
        if (!isAtom(atomVal)) {
          throw EvaluationError.atArg(`set-validator! expects an atom, got ${printString(atomVal)}`, { atomVal }, 0)
        }
        if (fn.kind === 'nil') {
          (atomVal as CljAtom).validator = undefined
          return cljNil()
        }
        if (!isAFunction(fn)) {
          throw EvaluationError.atArg(`set-validator! expects a function or nil, got ${printString(fn)}`, { fn }, 1)
        }
        (atomVal as CljAtom).validator = fn
        return cljNil()
      }
    ),
    'Sets the validator-fn for an atom. fn must be nil or a side-effect-free fn of one argument.',
    [['atom', 'fn']]
  ),
}
