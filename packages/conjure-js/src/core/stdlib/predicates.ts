// Predicates & logical: nil?, true?, false?, truthy?, falsy?, not, not=,
// number?, string?, boolean?, vector?, list?, map?, keyword?, symbol?, fn?,
// coll?, some, every?
import {
  isAFunction,
  isCollection,
  isEqual,
  isFalsy,
  isKeyword,
  isSeqable,
  isSymbol,
  isTruthy,
  isList,
  isVector,
  isMap,
} from '../assertions'
import { applyFunction } from '../evaluator'
import { EvaluationError } from '../errors'
import { cljBoolean, cljNativeFunction, cljNil, cljNumber, withDoc } from '../factories'
import { printString } from '../printer'
import { toSeq } from '../transformations'
import type { CljValue } from '../types'

export const predicateFunctions: Record<string, CljValue> = {
  'nil?': withDoc(
    cljNativeFunction('nil?', function nilPredImpl(arg: CljValue) {
      return cljBoolean(arg.kind === 'nil')
    }),
    'Returns true if the value is nil, false otherwise.',
    [['arg']]
  ),
  'true?': withDoc(
    cljNativeFunction('true?', function truePredImpl(arg: CljValue) {
      // returns true if the value is a boolean and true
      if (arg.kind !== 'boolean') {
        return cljBoolean(false)
      }
      return cljBoolean(arg.value === true)
    }),
    'Returns true if the value is a boolean and true, false otherwise.',
    [['arg']]
  ),
  'false?': withDoc(
    cljNativeFunction('false?', function falsePredImpl(arg: CljValue) {
      // returns true if the value is a boolean and false
      if (arg.kind !== 'boolean') {
        return cljBoolean(false)
      }
      return cljBoolean(arg.value === false)
    }),
    'Returns true if the value is a boolean and false, false otherwise.',
    [['arg']]
  ),
  'truthy?': withDoc(
    cljNativeFunction('truthy?', function truthyPredImpl(arg: CljValue) {
      return cljBoolean(isTruthy(arg))
    }),
    'Returns true if the value is not nil or false, false otherwise.',
    [['arg']]
  ),
  'falsy?': withDoc(
    cljNativeFunction('falsy?', function falsyPredImpl(arg: CljValue) {
      return cljBoolean(isFalsy(arg))
    }),
    'Returns true if the value is nil or false, false otherwise.',
    [['arg']]
  ),
  // not: withDoc(
  //   cljNativeFunction('not', function notImpl(arg: CljValue) {
  //     return cljBoolean(!isTruthy(arg))
  //   }),
  //   'Returns the negation of the truthiness of the value.',
  //   [['arg']]
  // ),
  'not=': withDoc(
    cljNativeFunction('not=', function notEqualImpl(...vals: CljValue[]) {
      if (vals.length < 2) {
        throw new EvaluationError('not= expects at least two arguments', {
          args: vals,
        })
      }
      for (let i = 1; i < vals.length; i++) {
        if (!isEqual(vals[i], vals[i - 1])) {
          return cljBoolean(true)
        }
      }
      return cljBoolean(false)
    }),
    'Returns true if any two adjacent arguments are not equal, false otherwise.',
    [['&', 'vals']]
  ),
  'number?': withDoc(
    cljNativeFunction('number?', function numberPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'number')
    }),
    'Returns true if the value is a number, false otherwise.',
    [['x']]
  ),

  'string?': withDoc(
    cljNativeFunction('string?', function stringPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'string')
    }),
    'Returns true if the value is a string, false otherwise.',
    [['x']]
  ),

  'boolean?': withDoc(
    cljNativeFunction('boolean?', function booleanPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'boolean')
    }),
    'Returns true if the value is a boolean, false otherwise.',
    [['x']]
  ),

  'vector?': withDoc(
    cljNativeFunction('vector?', function vectorPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isVector(x))
    }),
    'Returns true if the value is a vector, false otherwise.',
    [['x']]
  ),

  'list?': withDoc(
    cljNativeFunction('list?', function listPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isList(x))
    }),
    'Returns true if the value is a list, false otherwise.',
    [['x']]
  ),

  'map?': withDoc(
    cljNativeFunction('map?', function mapPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isMap(x))
    }),
    'Returns true if the value is a map, false otherwise.',
    [['x']]
  ),

  'keyword?': withDoc(
    cljNativeFunction('keyword?', function keywordPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isKeyword(x))
    }),
    'Returns true if the value is a keyword, false otherwise.',
    [['x']]
  ),

  'qualified-keyword?': withDoc(
    cljNativeFunction('qualified-keyword?', function qualifiedKeywordPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isKeyword(x) && x.name.includes('/'))
    }),
    'Returns true if the value is a qualified keyword, false otherwise.',
    [['x']]
  ),

  'symbol?': withDoc(
    cljNativeFunction('symbol?', function symbolPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isSymbol(x))
    }),
    'Returns true if the value is a symbol, false otherwise.',
    [['x']]
  ),

  'qualified-symbol?': withDoc(
    cljNativeFunction('qualified-symbol?', function qualifiedSymbolPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isSymbol(x) && x.name.includes('/'))
    }),
    'Returns true if the value is a qualified symbol, false otherwise.',
    [['x']]
  ),

  'fn?': withDoc(
    cljNativeFunction('fn?', function fnPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isAFunction(x))
    }),
    'Returns true if the value is a function, false otherwise.',
    [['x']]
  ),

  'coll?': withDoc(
    cljNativeFunction('coll?', function collPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isCollection(x))
    }),
    'Returns true if the value is a collection, false otherwise.',
    [['x']]
  ),
  some: withDoc(
    cljNativeFunction('some', function someImpl(pred: CljValue, coll: CljValue): CljValue {
      if (pred === undefined || !isAFunction(pred)) {
        throw EvaluationError.atArg(`some expects a function as first argument${pred !== undefined ? `, got ${printString(pred)}` : ''}`, { pred }, 0)
      }
      if (coll === undefined) {
        return cljNil()
      }
      if (!isSeqable(coll)) {
        throw EvaluationError.atArg(`some expects a collection or string as second argument, got ${printString(coll)}`, { coll }, 1)
      }
      for (const item of toSeq(coll)) {
        const result = applyFunction(pred, [item])
        if (isTruthy(result)) {
          return result
        }
      }
      return cljNil()
    }),
    'Returns the first truthy result of applying pred to each item in coll, or nil if no item satisfies pred.',
    [['pred', 'coll']]
  ),

  'every?': withDoc(
    cljNativeFunction('every?', function everyPredImpl(pred: CljValue, coll: CljValue): CljValue {
      if (pred === undefined || !isAFunction(pred)) {
        throw EvaluationError.atArg(`every? expects a function as first argument${pred !== undefined ? `, got ${printString(pred)}` : ''}`, { pred }, 0)
      }
      if (coll === undefined || !isSeqable(coll)) {
        throw EvaluationError.atArg(`every? expects a collection or string as second argument${coll !== undefined ? `, got ${printString(coll)}` : ''}`, { coll }, 1)
      }
      for (const item of toSeq(coll)) {
        if (isFalsy(applyFunction(pred, [item]))) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Returns true if all items in coll satisfy pred, false otherwise.',
    [['pred', 'coll']]
  ),

  'identical?': withDoc(
    cljNativeFunction('identical?', function identicalPredImpl(x: CljValue, y: CljValue) {
      return cljBoolean(x === y)
    }),
    'Tests if 2 arguments are the same object (reference equality).',
    [['x', 'y']]
  ),

  'seqable?': withDoc(
    cljNativeFunction('seqable?', function seqablePredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && isSeqable(x))
    }),
    'Return true if the seq function is supported for x.',
    [['x']]
  ),

  'sequential?': withDoc(
    cljNativeFunction('sequential?', function sequentialPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && (isList(x) || isVector(x)))
    }),
    'Returns true if coll is a sequential collection (list or vector).',
    [['coll']]
  ),

  'associative?': withDoc(
    cljNativeFunction('associative?', function associativePredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && (isMap(x) || isVector(x)))
    }),
    'Returns true if coll implements Associative (map or vector).',
    [['coll']]
  ),

  'counted?': withDoc(
    cljNativeFunction('counted?', function countedPredImpl(x: CljValue) {
      return cljBoolean(
        x !== undefined &&
        (isList(x) || isVector(x) || isMap(x) || x.kind === 'set' || x.kind === 'string')
      )
    }),
    'Returns true if coll implements count in constant time.',
    [['coll']]
  ),

  'int?': withDoc(
    cljNativeFunction('int?', function intPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'number' && Number.isInteger((x as import('../types').CljNumber).value))
    }),
    'Return true if x is a fixed precision integer.',
    [['x']]
  ),

  'double?': withDoc(
    cljNativeFunction('double?', function doublePredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'number')
    }),
    'Return true if x is a Double (all numbers in JS are doubles).',
    [['x']]
  ),

  'NaN?': withDoc(
    cljNativeFunction('NaN?', function nanPredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'number' && isNaN((x as import('../types').CljNumber).value))
    }),
    'Returns true if num is NaN, else false.',
    [['num']]
  ),

  'infinite?': withDoc(
    cljNativeFunction('infinite?', function infinitePredImpl(x: CljValue) {
      return cljBoolean(x !== undefined && x.kind === 'number' && !isFinite((x as import('../types').CljNumber).value))
    }),
    'Returns true if num is positive or negative infinity, else false.',
    [['num']]
  ),

  compare: withDoc(
    cljNativeFunction('compare', function compareImpl(x: CljValue, y: CljValue): CljValue {
      if (x.kind === 'nil' && y.kind === 'nil') return cljNumber(0)
      if (x.kind === 'nil') return cljNumber(-1)
      if (y.kind === 'nil') return cljNumber(1)
      if (x.kind === 'number' && y.kind === 'number') {
        return cljNumber(
          (x as import('../types').CljNumber).value < (y as import('../types').CljNumber).value ? -1 :
          (x as import('../types').CljNumber).value > (y as import('../types').CljNumber).value ? 1 : 0
        )
      }
      if (x.kind === 'string' && y.kind === 'string') {
        return cljNumber(x.value < y.value ? -1 : x.value > y.value ? 1 : 0)
      }
      if (isKeyword(x) && isKeyword(y)) {
        return cljNumber(x.name < y.name ? -1 : x.name > y.name ? 1 : 0)
      }
      throw new EvaluationError(`compare: cannot compare ${printString(x)} to ${printString(y)}`, { x, y })
    }),
    'Comparator. Returns a negative number, zero, or a positive number.',
    [['x', 'y']]
  ),

  hash: withDoc(
    cljNativeFunction('hash', function hashImpl(x: CljValue) {
      // Simple hash — consistent within a session, not cryptographic
      const s = printString(x)
      let h = 0
      for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
      }
      return cljNumber(h)
    }),
    'Returns the hash code of its argument.',
    [['x']]
  ),
}
