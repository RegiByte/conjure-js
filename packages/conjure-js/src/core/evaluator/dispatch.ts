import {
  isCallable,
  isEqual,
  isMultiMethod,
  isSpecialForm,
  isSymbol,
} from '../assertions'
import { EvaluationError } from '../errors'
import { printString } from '../printer'
import type {
  CljList,
  CljValue,
  Env,
  EvaluationContext,
  CljMultiMethod,
} from '../types'

import { evaluateSpecialForm } from './special-forms'

function dispatchMultiMethod(
  mm: CljMultiMethod,
  args: CljValue[],
  ctx: EvaluationContext,
  env: Env
): CljValue {
  const dispatchVal = ctx.applyFunction(mm.dispatchFn, args, env)
  const method = mm.methods.find(({ dispatchVal: dv }) =>
    isEqual(dv, dispatchVal)
  )
  if (method) return ctx.applyFunction(method.fn, args, env)
  if (mm.defaultMethod) return ctx.applyFunction(mm.defaultMethod, args, env)
  // TODO: Clojure supports a custom default-dispatch-val per multimethod:
  //   (defmulti foo identity :default ::no-match)
  // This lets :default be a real dispatchable value while ::no-match is the
  // fallback sentinel. Currently :default is hardcoded as the only sentinel,
  // making it impossible to dispatch on the literal value :default while also
  // having a catch-all. Low priority — add CljMultiMethod.defaultDispatchVal
  // and thread it through defmulti, defmethod detection, and here.
  throw new EvaluationError(
    `No method in multimethod '${mm.name}' for dispatch value ${printString(dispatchVal)}`,
    { mm, dispatchVal }
  )
}

export function evaluateList(
  list: CljList,
  env: Env,
  ctx: EvaluationContext
): CljValue {
  if (list.value.length === 0) {
    throw new EvaluationError('Unexpected empty list', { list, env })
  }
  const first = list.value[0]

  if (isSpecialForm(first)) {
    return evaluateSpecialForm(first.name, list, env, ctx)
  }

  const evaledFirst = ctx.evaluate(first, env)

  if (isMultiMethod(evaledFirst)) {
    const args = list.value.slice(1).map((v) => ctx.evaluate(v, env))
    return dispatchMultiMethod(evaledFirst, args, ctx, env)
  }

  if (!isCallable(evaledFirst)) {
    const name = isSymbol(first) ? first.name : printString(first)
    throw new EvaluationError(`${name} is not callable`, { list, env })
  }

  const args = list.value.slice(1).map((v) => ctx.evaluate(v, env))
  return ctx.applyCallable(evaledFirst, args, env)
}
