// Transducer protocol primitives: reduced, volatile!, transduce

import { isAFunction, isCollection, isReduced, isVolatile } from '../assertions'
import { EvaluationError } from '../errors'
import {
  cljBoolean,
  cljNativeFunction,
  cljNativeFunctionWithContext,
  cljReduced,
  cljVolatile,
} from '../factories'
import { printString } from '../printer'
import { toSeq } from '../transformations'
import type {
  CljFunction,
  CljNativeFunction,
  CljValue,
  EvaluationContext,
} from '../types'

export const transducerFunctions: Record<string, CljValue> = {
  // ── Reduced sentinel ────────────────────────────────────────────────────

  reduced: cljNativeFunction('reduced', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('reduced expects one argument', {})
    }
    return cljReduced(value)
  }),

  'reduced?': cljNativeFunction('reduced?', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('reduced? expects one argument', {})
    }
    return cljBoolean(isReduced(value))
  }),

  unreduced: cljNativeFunction('unreduced', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('unreduced expects one argument', {})
    }
    return isReduced(value) ? value.value : value
  }),

  'ensure-reduced': cljNativeFunction('ensure-reduced', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('ensure-reduced expects one argument', {})
    }
    return isReduced(value) ? value : cljReduced(value)
  }),

  // ── Volatile ─────────────────────────────────────────────────────────────

  'volatile!': cljNativeFunction('volatile!', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('volatile! expects one argument', {})
    }
    return cljVolatile(value)
  }),

  'volatile?': cljNativeFunction('volatile?', (value: CljValue) => {
    if (value === undefined) {
      throw new EvaluationError('volatile? expects one argument', {})
    }
    return cljBoolean(isVolatile(value))
  }),

  'vreset!': cljNativeFunction(
    'vreset!',
    (vol: CljValue, newVal: CljValue) => {
      if (!isVolatile(vol)) {
        throw new EvaluationError(
          `vreset! expects a volatile as its first argument, got ${printString(vol)}`,
          { vol }
        )
      }
      if (newVal === undefined) {
        throw new EvaluationError('vreset! expects two arguments', { vol })
      }
      vol.value = newVal
      return newVal
    }
  ),

  'vswap!': cljNativeFunctionWithContext(
    'vswap!',
    (
      ctx: EvaluationContext,
      vol: CljValue,
      fn: CljValue,
      ...extraArgs: CljValue[]
    ) => {
      if (!isVolatile(vol)) {
        throw new EvaluationError(
          `vswap! expects a volatile as its first argument, got ${printString(vol)}`,
          { vol }
        )
      }
      if (!isAFunction(fn)) {
        throw new EvaluationError(
          `vswap! expects a function as its second argument, got ${printString(fn)}`,
          { fn }
        )
      }
      const newVal = ctx.applyFunction(fn as CljFunction | CljNativeFunction, [
        vol.value,
        ...extraArgs,
      ])
      vol.value = newVal
      return newVal
    }
  ),

  // ── transduce ─────────────────────────────────────────────────────────────

  // (transduce xf f init coll)
  // xf  — transducer (1-arg fn: takes rf, returns composed rf)
  // f   — bottom reducing function
  // init — initial accumulator value
  // coll — source collection (nil is treated as empty)
  transduce: cljNativeFunctionWithContext(
    'transduce',
    (
      ctx: EvaluationContext,
      xf: CljValue,
      f: CljValue,
      init: CljValue,
      coll: CljValue
    ) => {
      if (!isAFunction(xf)) {
        throw new EvaluationError(
          `transduce expects a transducer (function) as first argument, got ${printString(xf)}`,
          { xf }
        )
      }
      if (!isAFunction(f)) {
        throw new EvaluationError(
          `transduce expects a reducing function as second argument, got ${printString(f)}`,
          { f }
        )
      }
      if (init === undefined) {
        throw new EvaluationError(
          'transduce expects 4 arguments: (transduce xf f init coll)',
          {}
        )
      }
      if (coll === undefined) {
        throw new EvaluationError(
          'transduce expects 4 arguments: (transduce xf f init coll)',
          {}
        )
      }

      // nil collection is treated as empty
      if (coll.kind === 'nil') {
        const rf = ctx.applyFunction(xf as CljFunction | CljNativeFunction, [f])
        return ctx.applyFunction(rf as CljFunction | CljNativeFunction, [init])
      }

      if (!isCollection(coll)) {
        throw new EvaluationError(
          `transduce expects a collection as fourth argument, got ${printString(coll)}`,
          { coll }
        )
      }

      // Apply transducer to bottom reducer to get the composed reducing fn
      const rf = ctx.applyFunction(
        xf as CljFunction | CljNativeFunction,
        [f]
      ) as CljFunction | CljNativeFunction

      // Step loop
      const items = toSeq(coll)
      let acc = init
      for (const item of items) {
        const result = ctx.applyFunction(rf, [acc, item])
        if (isReduced(result)) {
          acc = result.value
          break
        }
        acc = result
      }

      // Completion (1-arity call)
      return ctx.applyFunction(rf, [acc])
    }
  ),
}
