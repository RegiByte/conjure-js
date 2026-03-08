import { describe, it, expect } from 'vitest'
import { findFormBeforeCursor } from '../find-form'

describe('findFormBeforeCursor', () => {
  function at(source: string, marker = '|') {
    const offset = source.indexOf(marker)
    const clean = source.replace(marker, '')
    return findFormBeforeCursor(clean, offset)
  }

  function slice(source: string, marker = '|') {
    const r = at(source, marker)
    const clean = source.replace(marker, '')
    return r ? clean.slice(r.start, r.end) : null
  }

  it('returns null for empty source', () => {
    expect(findFormBeforeCursor('', 0)).toBeNull()
  })

  it('finds an atom before cursor', () => {
    expect(slice('foo|')).toBe('foo')
  })

  it('finds a number atom', () => {
    expect(slice('42|')).toBe('42')
  })

  it('finds a simple list', () => {
    expect(slice('(+ 1 2)|')).toBe('(+ 1 2)')
  })

  it('finds the inner form when cursor is inside outer', () => {
    expect(slice('(+ (+ 1 2)| 3)')).toBe('(+ 1 2)')
  })

  it('includes a quote prefix', () => {
    expect(slice("'(1 2 3)|")).toBe("'(1 2 3)")
  })

  it('finds the form before cursor when there are multiple top-level forms', () => {
    expect(slice('(def a 1) (+ a 2)|')).toBe('(+ a 2)')
  })

  it('returns null when cursor is after unmatched open bracket', () => {
    expect(at('(|')).toMatchObject({ start: 0, end: 1 })
  })

  // ── AnonFnStart (#(...)) ─────────────────────────────────────────────────────

  it('finds a standalone #(...) form', () => {
    expect(slice('#(+ % 1)|')).toBe('#(+ % 1)')
  })

  it('correctly matches RParen to AnonFnStart when scanning backwards', () => {
    // Before the fix, the inner RParen of #(...) would bump depth so that
    // findMatchingOpen would overshoot past the intended LParen and return
    // the wrong (or no) match.
    expect(slice('(map #(+ 1 %1) [1 2 3])|')).toBe('(map #(+ 1 %1) [1 2 3])')
  })

  it('does not bleed outside a (comment ...) wrapper', () => {
    const source = '(comment\n  (map #(+ 1 %1) [1 2 3])|)'
    expect(slice(source)).toBe('(map #(+ 1 %1) [1 2 3])')
  })

  it('handles #(...) nested inside a let binding', () => {
    expect(slice('(let [f #(* % 2)] (f 5))|')).toBe('(let [f #(* % 2)] (f 5))')
  })

  it('handles multiple #(...) in one form', () => {
    expect(slice('(map #(* % 2) (filter #(even? %) (range 10)))|')).toBe(
      '(map #(* % 2) (filter #(even? %) (range 10)))',
    )
  })
})
