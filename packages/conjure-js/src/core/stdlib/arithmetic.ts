import { isEqual, isList, isSeqable, isVector } from '../assertions'
import { EvaluationError } from '../errors'
import { cljBoolean, cljNativeFunction, cljNumber, cljVector, withDoc } from '../factories'
import { printString } from '../printer'
import { toSeq } from '../transformations'
import type { CljNumber, CljValue } from '../types'

export const arithmeticFunctions: Record<string, CljValue> = {
  '+': withDoc(
    cljNativeFunction('+', function add(...nums: CljValue[]) {
      if (nums.length === 0) {
        return cljNumber(0)
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('+ expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.reduce(function sumNumbers(acc, arg) {
        return cljNumber((acc as CljNumber).value + (arg as CljNumber).value)
      }, cljNumber(0))
    }),
    'Returns the sum of the arguments. Throws on non-number arguments.',
    [['&', 'nums']]
  ),

  '-': withDoc(
    cljNativeFunction('-', function subtract(...nums: CljValue[]) {
      if (nums.length === 0) {
        throw new EvaluationError('- expects at least one argument', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('- expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.slice(1).reduce(function subtractNumbers(acc, arg) {
        return cljNumber((acc as CljNumber).value - (arg as CljNumber).value)
      }, nums[0] as CljNumber)
    }),
    'Returns the difference of the arguments. Throws on non-number arguments.',
    [['&', 'nums']]
  ),

  '*': withDoc(
    cljNativeFunction('*', function multiply(...nums: CljValue[]) {
      if (nums.length === 0) {
        return cljNumber(1)
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('* expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.slice(1).reduce(function multiplyNumbers(acc, arg) {
        return cljNumber((acc as CljNumber).value * (arg as CljNumber).value)
      }, nums[0] as CljNumber)
    }),
    'Returns the product of the arguments. Throws on non-number arguments.',
    [['&', 'nums']]
  ),

  '/': withDoc(
    cljNativeFunction('/', function divide(...nums: CljValue[]) {
      if (nums.length === 0) {
        throw new EvaluationError('/ expects at least one argument', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('/ expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.slice(1).reduce(function divideNumbers(acc, arg, reduceIdx) {
        if ((arg as CljNumber).value === 0) {
          const err = new EvaluationError('division by zero', { args: nums })
          err.data = { argIndex: reduceIdx + 1 }
          throw err
        }
        return cljNumber((acc as CljNumber).value / (arg as CljNumber).value)
      }, nums[0] as CljNumber)
    }),
    'Returns the quotient of the arguments. Throws on non-number arguments or division by zero.',
    [['&', 'nums']]
  ),

  '>': withDoc(
    cljNativeFunction('>', function greaterThan(...nums: CljValue[]) {
      if (nums.length < 2) {
        throw new EvaluationError('> expects at least two arguments', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('> expects all arguments to be numbers', { args: nums }, badIdx)
      }
      for (let i = 1; i < nums.length; i++) {
        if ((nums[i] as CljNumber).value >= (nums[i - 1] as CljNumber).value) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Compares adjacent arguments left to right, returns true if all values are in ascending order, false otherwise.',
    [['&', 'nums']]
  ),

  '<': withDoc(
    cljNativeFunction('<', function lessThan(...nums: CljValue[]) {
      if (nums.length < 2) {
        throw new EvaluationError('< expects at least two arguments', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('< expects all arguments to be numbers', { args: nums }, badIdx)
      }
      for (let i = 1; i < nums.length; i++) {
        if ((nums[i] as CljNumber).value <= (nums[i - 1] as CljNumber).value) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Compares adjacent arguments left to right, returns true if all values are in descending order, false otherwise.',
    [['&', 'nums']]
  ),

  '>=': withDoc(
    cljNativeFunction('>=', function greaterThanOrEqual(...nums: CljValue[]) {
      if (nums.length < 2) {
        throw new EvaluationError('>= expects at least two arguments', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('>= expects all arguments to be numbers', { args: nums }, badIdx)
      }
      for (let i = 1; i < nums.length; i++) {
        if ((nums[i] as CljNumber).value > (nums[i - 1] as CljNumber).value) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Compares adjacent arguments left to right, returns true if all comparisons returns true for greater than or equal to checks, false otherwise.',
    [['&', 'nums']]
  ),

  '<=': withDoc(
    cljNativeFunction('<=', function lessThanOrEqual(...nums: CljValue[]) {
      if (nums.length < 2) {
        throw new EvaluationError('<= expects at least two arguments', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('<= expects all arguments to be numbers', { args: nums }, badIdx)
      }
      for (let i = 1; i < nums.length; i++) {
        if ((nums[i] as CljNumber).value < (nums[i - 1] as CljNumber).value) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Compares adjacent arguments left to right, returns true if all comparisons returns true for less than or equal to checks, false otherwise.',
    [['&', 'nums']]
  ),

  '=': withDoc(
    cljNativeFunction('=', function equals(...vals: CljValue[]) {
      if (vals.length < 2) {
        throw new EvaluationError('= expects at least two arguments', {
          args: vals,
        })
      }
      for (let i = 1; i < vals.length; i++) {
        if (!isEqual(vals[i], vals[i - 1])) {
          return cljBoolean(false)
        }
      }
      return cljBoolean(true)
    }),
    'Compares adjacent arguments left to right, returns true if all values are structurally equal, false otherwise.',
    [['&', 'vals']]
  ),

  inc: withDoc(
    cljNativeFunction('inc', function increment(x: CljValue) {
      if (x === undefined || x.kind !== 'number') {
        throw EvaluationError.atArg(`inc expects a number${x !== undefined ? `, got ${printString(x)}` : ''}`, { x }, 0)
      }
      return cljNumber((x as CljNumber).value + 1)
    }),
    'Returns the argument incremented by 1. Throws on non-number arguments.',
    [['x']]
  ),

  dec: withDoc(
    cljNativeFunction('dec', function decrement(x: CljValue) {
      if (x === undefined || x.kind !== 'number') {
        throw EvaluationError.atArg(`dec expects a number${x !== undefined ? `, got ${printString(x)}` : ''}`, { x }, 0)
      }
      return cljNumber((x as CljNumber).value - 1)
    }),
    'Returns the argument decremented by 1. Throws on non-number arguments.',
    [['x']]
  ),

  max: withDoc(
    cljNativeFunction('max', function maximum(...nums: CljValue[]) {
      if (nums.length === 0) {
        throw new EvaluationError('max expects at least one argument', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('max expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.reduce(function findMax(best, arg) {
        return (arg as CljNumber).value > (best as CljNumber).value ? arg : best
      })
    }),
    'Returns the largest of the arguments. Throws on non-number arguments.',
    [['&', 'nums']]
  ),

  min: withDoc(
    cljNativeFunction('min', function minimum(...nums: CljValue[]) {
      if (nums.length === 0) {
        throw new EvaluationError('min expects at least one argument', {
          args: nums,
        })
      }
      const badIdx = nums.findIndex(function isNotNumber(a) {
        return a.kind !== 'number'
      })
      if (badIdx !== -1) {
        throw EvaluationError.atArg('min expects all arguments to be numbers', { args: nums }, badIdx)
      }
      return nums.reduce(function findMin(best, arg) {
        return (arg as CljNumber).value < (best as CljNumber).value ? arg : best
      })
    }),
    'Returns the smallest of the arguments. Throws on non-number arguments.',
    [['&', 'nums']]
  ),

  mod: withDoc(
    cljNativeFunction('mod', function modulo(n: CljValue, d: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`mod expects a number as first argument${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      if (d === undefined || d.kind !== 'number') {
        throw EvaluationError.atArg(`mod expects a number as second argument${d !== undefined ? `, got ${printString(d)}` : ''}`, { d }, 1)
      }
      if ((d as CljNumber).value === 0) {
        const err = new EvaluationError('mod: division by zero', { n, d })
        err.data = { argIndex: 1 }
        throw err
      }
      // Clojure mod always returns non-negative when divisor is positive
      const result = (n as CljNumber).value % (d as CljNumber).value
      return cljNumber(
        result < 0 ? result + Math.abs((d as CljNumber).value) : result
      )
    }),
    'Returns the remainder of the first argument divided by the second argument. Throws on non-number arguments or division by zero.',
    [['n', 'd']]
  ),

  'even?': withDoc(
    cljNativeFunction('even?', function isEven(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`even? expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljBoolean((n as CljNumber).value % 2 === 0)
    }),
    'Returns true if the argument is an even number, false otherwise.',
    [['n']]
  ),

  'odd?': withDoc(
    cljNativeFunction('odd?', function isOdd(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`odd? expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljBoolean(Math.abs((n as CljNumber).value) % 2 !== 0)
    }),
    'Returns true if the argument is an odd number, false otherwise.',
    [['n']]
  ),

  'pos?': withDoc(
    cljNativeFunction('pos?', function isPositive(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`pos? expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljBoolean((n as CljNumber).value > 0)
    }),
    'Returns true if the argument is a positive number, false otherwise.',
    [['n']]
  ),

  'neg?': withDoc(
    cljNativeFunction('neg?', function isNegative(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`neg? expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljBoolean((n as CljNumber).value < 0)
    }),
    'Returns true if the argument is a negative number, false otherwise.',
    [['n']]
  ),

  'zero?': withDoc(
    cljNativeFunction('zero?', function isZero(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`zero? expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljBoolean((n as CljNumber).value === 0)
    }),
    'Returns true if the argument is zero, false otherwise.',
    [['n']]
  ),

  abs: withDoc(
    cljNativeFunction('abs', function absImpl(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`abs expects a number${n !== undefined ? `, got ${printString(n)}` : ''}`, { n }, 0)
      }
      return cljNumber(Math.abs((n as CljNumber).value))
    }),
    'Returns the absolute value of a.',
    [['a']]
  ),

  quot: withDoc(
    cljNativeFunction('quot', function quotImpl(num: CljValue, div: CljValue) {
      if (num === undefined || num.kind !== 'number') {
        throw EvaluationError.atArg(`quot expects a number as first argument`, { num }, 0)
      }
      if (div === undefined || div.kind !== 'number') {
        throw EvaluationError.atArg(`quot expects a number as second argument`, { div }, 1)
      }
      if ((div as CljNumber).value === 0) {
        throw new EvaluationError('quot: division by zero', { num, div })
      }
      return cljNumber(Math.trunc((num as CljNumber).value / (div as CljNumber).value))
    }),
    'quot[ient] of dividing numerator by denominator.',
    [['num', 'div']]
  ),

  rem: withDoc(
    cljNativeFunction('rem', function remImpl(num: CljValue, div: CljValue) {
      if (num === undefined || num.kind !== 'number') {
        throw EvaluationError.atArg(`rem expects a number as first argument`, { num }, 0)
      }
      if (div === undefined || div.kind !== 'number') {
        throw EvaluationError.atArg(`rem expects a number as second argument`, { div }, 1)
      }
      if ((div as CljNumber).value === 0) {
        throw new EvaluationError('rem: division by zero', { num, div })
      }
      return cljNumber((num as CljNumber).value % (div as CljNumber).value)
    }),
    'remainder of dividing numerator by denominator.',
    [['num', 'div']]
  ),

  rand: withDoc(
    cljNativeFunction('rand', function randImpl(...args: CljValue[]) {
      if (args.length === 0) return cljNumber(Math.random())
      if (args[0].kind !== 'number') {
        throw EvaluationError.atArg(`rand expects a number`, { n: args[0] }, 0)
      }
      return cljNumber(Math.random() * (args[0] as CljNumber).value)
    }),
    'Returns a random floating point number between 0 (inclusive) and n (default 1) (exclusive).',
    [[], ['n']]
  ),

  'rand-int': withDoc(
    cljNativeFunction('rand-int', function randIntImpl(n: CljValue) {
      if (n === undefined || n.kind !== 'number') {
        throw EvaluationError.atArg(`rand-int expects a number`, { n }, 0)
      }
      return cljNumber(Math.floor(Math.random() * (n as CljNumber).value))
    }),
    'Returns a random integer between 0 (inclusive) and n (exclusive).',
    [['n']]
  ),

  'rand-nth': withDoc(
    cljNativeFunction('rand-nth', function randNthImpl(coll: CljValue) {
      if (coll === undefined || (!isList(coll) && !isVector(coll))) {
        throw EvaluationError.atArg(`rand-nth expects a list or vector`, { coll }, 0)
      }
      const items = (coll as import('../types').CljList | import('../types').CljVector).value
      if (items.length === 0) {
        throw new EvaluationError('rand-nth called on empty collection', { coll })
      }
      return items[Math.floor(Math.random() * items.length)]
    }),
    'Return a random element of the (sequential) collection.',
    [['coll']]
  ),

  shuffle: withDoc(
    cljNativeFunction('shuffle', function shuffleImpl(coll: CljValue) {
      if (coll === undefined || coll.kind === 'nil') return cljVector([])
      if (!isSeqable(coll)) {
        throw EvaluationError.atArg(`shuffle expects a collection, got ${printString(coll)}`, { coll }, 0)
      }
      const arr = [...toSeq(coll)]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return cljVector(arr)
    }),
    'Return a random permutation of coll.',
    [['coll']]
  ),

  'bit-and': withDoc(
    cljNativeFunction('bit-and', function bitAndImpl(x: CljValue, y: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-and expects numbers', { x }, 0)
      if (y?.kind !== 'number') throw EvaluationError.atArg('bit-and expects numbers', { y }, 1)
      return cljNumber((x as CljNumber).value & (y as CljNumber).value)
    }),
    'Bitwise and',
    [['x', 'y']]
  ),

  'bit-or': withDoc(
    cljNativeFunction('bit-or', function bitOrImpl(x: CljValue, y: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-or expects numbers', { x }, 0)
      if (y?.kind !== 'number') throw EvaluationError.atArg('bit-or expects numbers', { y }, 1)
      return cljNumber((x as CljNumber).value | (y as CljNumber).value)
    }),
    'Bitwise or',
    [['x', 'y']]
  ),

  'bit-xor': withDoc(
    cljNativeFunction('bit-xor', function bitXorImpl(x: CljValue, y: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-xor expects numbers', { x }, 0)
      if (y?.kind !== 'number') throw EvaluationError.atArg('bit-xor expects numbers', { y }, 1)
      return cljNumber((x as CljNumber).value ^ (y as CljNumber).value)
    }),
    'Bitwise exclusive or',
    [['x', 'y']]
  ),

  'bit-not': withDoc(
    cljNativeFunction('bit-not', function bitNotImpl(x: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-not expects a number', { x }, 0)
      return cljNumber(~(x as CljNumber).value)
    }),
    'Bitwise complement',
    [['x']]
  ),

  'bit-shift-left': withDoc(
    cljNativeFunction('bit-shift-left', function bitShiftLeftImpl(x: CljValue, n: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-shift-left expects numbers', { x }, 0)
      if (n?.kind !== 'number') throw EvaluationError.atArg('bit-shift-left expects numbers', { n }, 1)
      return cljNumber((x as CljNumber).value << (n as CljNumber).value)
    }),
    'Bitwise shift left',
    [['x', 'n']]
  ),

  'bit-shift-right': withDoc(
    cljNativeFunction('bit-shift-right', function bitShiftRightImpl(x: CljValue, n: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('bit-shift-right expects numbers', { x }, 0)
      if (n?.kind !== 'number') throw EvaluationError.atArg('bit-shift-right expects numbers', { n }, 1)
      return cljNumber((x as CljNumber).value >> (n as CljNumber).value)
    }),
    'Bitwise shift right',
    [['x', 'n']]
  ),

  'unsigned-bit-shift-right': withDoc(
    cljNativeFunction('unsigned-bit-shift-right', function unsignedBitShiftRightImpl(x: CljValue, n: CljValue) {
      if (x?.kind !== 'number') throw EvaluationError.atArg('unsigned-bit-shift-right expects numbers', { x }, 0)
      if (n?.kind !== 'number') throw EvaluationError.atArg('unsigned-bit-shift-right expects numbers', { n }, 1)
      return cljNumber((x as CljNumber).value >>> (n as CljNumber).value)
    }),
    'Bitwise shift right, without sign-extension',
    [['x', 'n']]
  ),
}
