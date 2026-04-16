import { describe, expect, it } from 'vitest'
import { v } from '../../factories'
import { expectError, freshSession } from './evaluator-test-utils'

describe('parse-long', () => {
  it.each([
    ['(parse-long "42")', v.number(42)],
    ['(parse-long "-7")', v.number(-7)],
    ['(parse-long "+100")', v.number(100)],
    ['(parse-long "0")', v.number(0)],
    ['(parse-long "abc")', v.nil()],
    ['(parse-long "3.14")', v.nil()],
    ['(parse-long "")', v.nil()],
    ['(parse-long "12abc")', v.nil()],
    ['(parse-long " 42")', v.nil()],
  ])('%s => %s', (code, expected) => {
    expect(freshSession().evaluate(code)).toMatchObject(expected)
  })

  it('throws on non-string input', () => {
    expectError('(parse-long 42)', 'parse-long expects a string')
    expectError('(parse-long nil)', 'parse-long expects a string')
  })
})

describe('parse-double', () => {
  it.each([
    ['(parse-double "3.14")', v.number(3.14)],
    ['(parse-double "1e5")', v.number(100000)],
    ['(parse-double "-0.5")', v.number(-0.5)],
    ['(parse-double "0")', v.number(0)],
    ['(parse-double "42")', v.number(42)],
    ['(parse-double "nope")', v.nil()],
    ['(parse-double "")', v.nil()],
    ['(parse-double "1.2.3")', v.nil()],
    ['(parse-double "1e5abc")', v.nil()],
  ])('%s', (code, expected) => {
    expect(freshSession().evaluate(code)).toMatchObject(expected)
  })

  it('throws on non-string input', () => {
    expectError('(parse-double 3.14)', 'parse-double expects a string')
    expectError('(parse-double nil)', 'parse-double expects a string')
  })
})

describe('parse-boolean', () => {
  it.each([
    ['(parse-boolean "true")', v.boolean(true)],
    ['(parse-boolean "false")', v.boolean(false)],
    ['(parse-boolean "yes")', v.nil()],
    ['(parse-boolean "no")', v.nil()],
    ['(parse-boolean "TRUE")', v.nil()],
    ['(parse-boolean "1")', v.nil()],
    ['(parse-boolean "")', v.nil()],
  ])('%s', (code, expected) => {
    expect(freshSession().evaluate(code)).toMatchObject(expected)
  })

  it('throws on non-string input', () => {
    expectError('(parse-boolean true)', 'parse-boolean expects a string')
    expectError('(parse-boolean nil)', 'parse-boolean expects a string')
  })
})
