import { isAtom, isAFunction, isReduced, isVolatile } from '../assertions'
import { EvaluationError } from '../errors'
import {
  cljAtom,
  cljBoolean,
  cljNativeFunctionWithContext,
  cljNativeFunction,
  withDoc,
} from '../factories'
import type { CljValue, Env } from '../types'

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
        const newVal = ctx.applyFunction(fn, [atomVal.value, ...extraArgs], callEnv)
        atomVal.value = newVal
        return newVal
      }
    ),
    'Applies fn to the current value of the atom, replacing the current value with the result. Returns the new value.',
    [['atomVal', 'fn', '&', 'extraArgs']]
  ),

  'reset!': withDoc(
    cljNativeFunction('reset!', function reset(atomVal: CljValue, newVal: CljValue) {
      if (!isAtom(atomVal)) {
        throw EvaluationError.atArg(`reset! expects an atom as its first argument, got ${atomVal.kind}`, { atomVal }, 0)
      }
      atomVal.value = newVal
      return newVal
    }),
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
}
