import { isList, isMap, isSymbol, isVector } from '../assertions'
import { extend } from '../env'
import { EvaluationError } from '../errors'
import { cljList, cljNil } from '../factories'
import type {
  Arity,
  CljValue,
  CljVector,
  DestructurePattern,
  Env,
  EvaluationContext,
} from '../types'
import { destructureBindings } from './destructure'

export class RecurSignal {
  args: CljValue[]
  constructor(args: CljValue[]) {
    this.args = args
  }
}

export function parseParamVector(
  args: CljVector,
  env: Env
): { params: DestructurePattern[]; restParam: DestructurePattern | null } {
  const ampIdx = args.value.findIndex((a) => isSymbol(a) && a.name === '&')
  let params: DestructurePattern[] = []
  let restParam: DestructurePattern | null = null
  if (ampIdx === -1) {
    params = args.value as DestructurePattern[]
  } else {
    const ampsCount = args.value.filter(
      (a) => isSymbol(a) && a.name === '&'
    ).length
    if (ampsCount > 1) {
      throw new EvaluationError('& can only appear once', { args, env })
    }
    if (ampIdx !== args.value.length - 2) {
      throw new EvaluationError('& must be second-to-last argument', {
        args,
        env,
      })
    }
    params = args.value.slice(0, ampIdx) as DestructurePattern[]
    restParam = args.value[ampIdx + 1] as DestructurePattern
  }
  return { params, restParam }
}

export function parseArities(forms: CljValue[], env: Env): Arity[] {
  if (forms.length === 0) {
    throw new EvaluationError(
      'fn/defmacro requires at least a parameter vector',
      {
        forms,
        env,
      }
    )
  }

  if (isVector(forms[0])) {
    const paramVec = forms[0]
    const { params, restParam } = parseParamVector(paramVec, env)
    return [{ params, restParam, body: forms.slice(1) }]
  }

  if (isList(forms[0])) {
    const arities: Arity[] = []
    for (const form of forms) {
      if (!isList(form) || form.value.length === 0) {
        throw new EvaluationError(
          'Multi-arity clause must be a list starting with a parameter vector',
          { form, env }
        )
      }
      const paramVec = form.value[0]
      if (!isVector(paramVec)) {
        throw new EvaluationError(
          'First element of arity clause must be a parameter vector',
          { paramVec, env }
        )
      }
      const { params, restParam } = parseParamVector(paramVec, env)
      arities.push({ params, restParam, body: form.value.slice(1) })
    }

    const variadicCount = arities.filter((a) => a.restParam !== null).length
    if (variadicCount > 1) {
      throw new EvaluationError(
        'At most one variadic arity is allowed per function',
        { forms, env }
      )
    }

    return arities
  }

  throw new EvaluationError(
    'fn/defmacro expects a parameter vector or arity clauses',
    { forms, env }
  )
}

export function bindParams(
  params: DestructurePattern[],
  restParam: DestructurePattern | null,
  args: CljValue[],
  outerEnv: Env,
  ctx: EvaluationContext,
  bindEnv: Env
): Env {
  if (restParam === null) {
    if (args.length !== params.length) {
      throw new EvaluationError(
        `Arguments length mismatch: fn accepts ${params.length} arguments, but ${args.length} were provided`,
        { params, args, outerEnv }
      )
    }
  } else {
    if (args.length < params.length) {
      throw new EvaluationError(
        `Arguments length mismatch: fn expects at least ${params.length} arguments, but ${args.length} were provided`,
        { params, args, outerEnv }
      )
    }
  }

  const allPairs: [string, CljValue][] = []

  for (let i = 0; i < params.length; i++) {
    allPairs.push(...destructureBindings(params[i], args[i], ctx, bindEnv))
  }

  if (restParam !== null) {
    const restArgs = args.slice(params.length)
    let restValue: CljValue
    if (isMap(restParam) && restArgs.length > 0) {
      const entries: [CljValue, CljValue][] = []
      for (let i = 0; i < restArgs.length; i += 2) {
        entries.push([restArgs[i], restArgs[i + 1] ?? cljNil()])
      }
      restValue = { kind: 'map', entries }
    } else {
      restValue = restArgs.length > 0 ? cljList(restArgs) : cljNil()
    }
    allPairs.push(...destructureBindings(restParam, restValue, ctx, bindEnv))
  }

  return extend(
    allPairs.map(([n]) => n),
    allPairs.map(([, v]) => v),
    outerEnv
  )
}

export function resolveArity(arities: Arity[], argCount: number): Arity {
  const exactMatch = arities.find(
    (a) => a.restParam === null && a.params.length === argCount
  )
  if (exactMatch) return exactMatch

  const variadicMatch = arities.find(
    (a) => a.restParam !== null && argCount >= a.params.length
  )
  if (variadicMatch) return variadicMatch

  const counts = arities.map((a) =>
    a.restParam ? `${a.params.length}+` : `${a.params.length}`
  )
  throw new EvaluationError(
    `No matching arity for ${argCount} arguments. Available arities: ${counts.join(', ')}`,
    { arities, argCount }
  )
}
