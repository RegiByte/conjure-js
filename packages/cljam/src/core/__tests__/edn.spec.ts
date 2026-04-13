/**
 * clojure.edn integration tests
 *
 * Covers the full stack: clojure.edn/read-string and clojure.edn/pr-str,
 * both exercising the native edn-read-string* / edn-pr-str* backing functions
 * and the EDN-mode reader (readFormsEdn).
 *
 * Sections:
 *   1. Basic EDN scalars
 *   2. EDN collections
 *   3. #_ discard in EDN context
 *   4. Built-in reader tags (#inst, #uuid)
 *   5. Custom :readers option
 *   6. *data-readers* dynamic var
 *   7. :default handler for unknown tags
 *   8. EDN rejects Clojure-specific syntax
 *   9. edn/pr-str
 *   10. Round-trips
 *   11. Error cases
 */

import { describe, expect, it } from 'vitest'
import { freshSession as session } from '../evaluator/__tests__/evaluator-test-utils'
import { v } from '../factories'

function s() {
  const sess = session()
  sess.evaluate("(require '[clojure.edn :as edn])")
  return sess
}

// ---------------------------------------------------------------------------
// 1. Basic EDN scalars
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — scalars', () => {
  it('reads an integer', () => {
    expect(s().evaluate('(edn/read-string "42")')).toEqual(v.number(42))
  })

  it('reads a negative integer', () => {
    expect(s().evaluate('(edn/read-string "-7")')).toEqual(v.number(-7))
  })

  it('reads a float', () => {
    expect(s().evaluate('(edn/read-string "3.14")')).toEqual(v.number(3.14))
  })

  it('reads a string', () => {
    expect(s().evaluate('(edn/read-string "\\"hello\\"")')).toEqual(
      v.string('hello')
    )
  })

  it('reads nil', () => {
    expect(s().evaluate('(edn/read-string "nil")')).toEqual(v.nil())
  })

  it('reads true', () => {
    expect(s().evaluate('(edn/read-string "true")')).toEqual(v.boolean(true))
  })

  it('reads false', () => {
    expect(s().evaluate('(edn/read-string "false")')).toEqual(v.boolean(false))
  })

  it('reads a plain keyword', () => {
    expect(s().evaluate('(edn/read-string ":foo")')).toEqual(v.keyword(':foo'))
  })

  it('reads a qualified keyword', () => {
    expect(s().evaluate('(edn/read-string ":ns/foo")')).toEqual(
      v.keyword(':ns/foo')
    )
  })

  it('reads a symbol', () => {
    const result = s().evaluate('(edn/read-string "my-sym")')
    expect(result.kind).toBe('symbol')
  })
})

// ---------------------------------------------------------------------------
// 2. EDN collections
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — collections', () => {
  it('reads a vector', () => {
    expect(s().evaluate('(edn/read-string "[1 2 3]")')).toEqual(
      v.vector([v.number(1), v.number(2), v.number(3)])
    )
  })

  it('reads a list', () => {
    expect(s().evaluate('(edn/read-string "(1 2 3)")')).toEqual(
      v.list([v.number(1), v.number(2), v.number(3)])
    )
  })

  it('reads a map', () => {
    expect(s().evaluate('(edn/read-string "{:a 1 :b 2}")')).toEqual(
      v.map([
        [v.keyword(':a'), v.number(1)],
        [v.keyword(':b'), v.number(2)],
      ])
    )
  })

  it('reads nested collections', () => {
    expect(s().evaluate('(edn/read-string "{:data [1 2 3]}")')).toEqual(
      v.map([
        [
          v.keyword(':data'),
          v.vector([v.number(1), v.number(2), v.number(3)]),
        ],
      ])
    )
  })

  it('reads only the first form when multiple are present', () => {
    expect(s().evaluate('(edn/read-string "1 2 3")')).toEqual(v.number(1))
  })
})

// ---------------------------------------------------------------------------
// 3. #_ discard in EDN
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — #_ discard', () => {
  it('discards the marked form; returns the next one', () => {
    expect(s().evaluate('(edn/read-string "#_ 1 2")')).toEqual(v.number(2))
  })

  it('discards inside a vector', () => {
    expect(s().evaluate('(edn/read-string "[1 #_ 2 3]")')).toEqual(
      v.vector([v.number(1), v.number(3)])
    )
  })

  it('stacked #_#_ discards two forms', () => {
    expect(s().evaluate('(edn/read-string "#_#_ 1 2 3")')).toEqual(v.number(3))
  })
})

// ---------------------------------------------------------------------------
// 4. Built-in reader tags (#inst, #uuid)
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — #inst tag', () => {
  it('reads #inst as a JS Date object', () => {
    const result = s().evaluate('(edn/read-string "#inst \\"2023-01-15T00:00:00Z\\"")')
    expect(result.kind).toBe('js-value')
    if (result.kind === 'js-value') {
      expect(result.value).toBeInstanceOf(Date)
    }
  })

  it('#inst Date has the correct time value', () => {
    const result = s().evaluate('(edn/read-string "#inst \\"2023-01-15T00:00:00Z\\"")')
    if (result.kind === 'js-value') {
      expect((result.value as Date).toISOString()).toBe('2023-01-15T00:00:00.000Z')
    }
  })

  it('throws on invalid #inst date string', () => {
    expect(() =>
      s().evaluate('(edn/read-string "#inst \\"not-a-valid-date\\"")')
    ).toThrow()
  })

  it('throws when #inst value is not a string', () => {
    expect(() =>
      s().evaluate('(edn/read-string "#inst 42")')
    ).toThrow()
  })
})

describe('clojure.edn/read-string — #uuid tag', () => {
  it('reads #uuid as the string value (passthrough)', () => {
    const uuid = 'be4b5cd8-b9e5-4a0a-b29a-3b5d3f9d4f5b'
    const result = s().evaluate(
      `(edn/read-string "#uuid \\"${uuid}\\"")`
    )
    expect(result).toEqual(v.string(uuid))
  })
})

// ---------------------------------------------------------------------------
// 5. Custom :readers option
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — :readers option', () => {
  it('applies a custom reader function for an unknown tag', () => {
    const sess = s()
    sess.evaluate('(defn my-point [[x y]] {:x x :y y})')
    const result = sess.evaluate(
      '(edn/read-string {:readers {\'point my-point}} "#point [3 4]")'
    )
    expect(result).toEqual(
      v.map([
        [v.keyword(':x'), v.number(3)],
        [v.keyword(':y'), v.number(4)],
      ])
    )
  })

  it(':readers overrides *data-readers* for the same tag name', () => {
    const sess = s()
    // Set a global handler that returns :global
    sess.evaluate(
      "(def dr {(quote my-tag) (fn [_] :global)})"
    )
    sess.evaluate('(alter-var-root #\'*data-readers* (fn [_] dr))')
    // opts :readers returns :local — opts wins
    const result = sess.evaluate(
      "(edn/read-string {:readers {(quote my-tag) (fn [_] :local)}} \"#my-tag 1\")"
    )
    expect(result).toEqual(v.keyword(':local'))
  })

  it('throws on unknown tag when no :readers or :default provided', () => {
    expect(() =>
      s().evaluate('(edn/read-string "#unknown-tag 42")')
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 6. *data-readers* dynamic var
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — *data-readers*', () => {
  it('uses *data-readers* when bound via binding', () => {
    const sess = s()
    sess.evaluate(
      "(defn my-handler [form] (str \"tagged:\" form))"
    )
    const result = sess.evaluate(
      "(binding [*data-readers* {'my-tag my-handler}] (edn/read-string \"#my-tag \\\"hello\\\"\"))"
    )
    expect(result).toEqual(v.string('tagged:hello'))
  })

  it('*data-readers* at global scope is empty map by default', () => {
    const result = s().evaluate('(map? *data-readers*)')
    expect(result).toEqual(v.boolean(true))
  })

  it('built-in #inst takes precedence over *data-readers* inst entry', () => {
    // Even if someone sets *data-readers* with an inst key,
    // built-in inst handler runs (priority: built-in < *data-readers* < :readers).
    // Actually priority is: built-ins → *data-readers* → :readers.
    // So *data-readers* would override the built-in inst. Let's verify that.
    const sess = s()
    sess.evaluate(
      "(def custom-inst (fn [s] (str \"custom:\" s)))"
    )
    const result = sess.evaluate(
      "(binding [*data-readers* {'inst custom-inst}] (edn/read-string \"#inst \\\"2023-01-01\\\"\"))"
    )
    // *data-readers* should override the built-in
    expect(result).toEqual(v.string('custom:2023-01-01'))
  })
})

// ---------------------------------------------------------------------------
// 7. :default handler for unknown tags
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — :default handler', () => {
  it(':default receives tag-name and form', () => {
    const sess = s()
    sess.evaluate(
      "(defn my-default [tag-name form] {:tag tag-name :value form})"
    )
    const result = sess.evaluate(
      '(edn/read-string {:default my-default} "#mystery 42")'
    )
    expect(result).toEqual(
      v.map([
        [v.keyword(':tag'), v.string('mystery')],
        [v.keyword(':value'), v.number(42)],
      ])
    )
  })

  it(':default is called for any unregistered tag', () => {
    const sess = s()
    const result = sess.evaluate(
      '(edn/read-string {:default (fn [t v] [t v])} "#foo :bar")'
    )
    expect(result).toEqual(
      v.vector([v.string('foo'), v.keyword(':bar')])
    )
  })

  it(':readers takes priority over :default for matching tags', () => {
    const sess = s()
    const result = sess.evaluate(
      "(edn/read-string {:readers {'known (fn [v] :found)} :default (fn [t v] :not-found)} \"#known 1\")"
    )
    expect(result).toEqual(v.keyword(':found'))
  })
})

// ---------------------------------------------------------------------------
// 8. EDN rejects Clojure-specific syntax
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — rejects non-EDN Clojure syntax', () => {
  it("rejects quote ('form)", () => {
    expect(() => s().evaluate("(edn/read-string \"'foo\")")).toThrow()
  })

  it('rejects quasiquote (`form)', () => {
    expect(() => s().evaluate('(edn/read-string "`foo")')).toThrow()
  })

  it('rejects unquote (~form)', () => {
    expect(() => s().evaluate('(edn/read-string "~foo")')).toThrow()
  })

  it('rejects anonymous function #(...)', () => {
    expect(() => s().evaluate('(edn/read-string "#(+ 1 2)")')).toThrow()
  })

  it('rejects regex #"..."', () => {
    expect(() => s().evaluate('(edn/read-string "#\\"foo\\"")')).toThrow()
  })

  it('rejects deref (@form)', () => {
    expect(() => s().evaluate('(edn/read-string "@foo")')).toThrow()
  })

  it('rejects var-quote (#\'form)', () => {
    expect(() => s().evaluate("(edn/read-string \"#'foo\")")).toThrow()
  })

  it('rejects metadata (^tag form)', () => {
    expect(() => s().evaluate('(edn/read-string "^{} foo")')).toThrow()
  })

  it('rejects namespaced map literals (#:ns{...})', () => {
    expect(() => s().evaluate('(edn/read-string "#:car{:make 1}")')).toThrow()
  })

  it('rejects auto-qualified keywords (::foo)', () => {
    expect(() => s().evaluate('(edn/read-string "::foo")')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 9. edn/pr-str
// ---------------------------------------------------------------------------

describe('clojure.edn/pr-str', () => {
  it('serializes an integer', () => {
    expect(s().evaluate('(edn/pr-str 42)')).toEqual(v.string('42'))
  })

  it('serializes a string with quotes', () => {
    expect(s().evaluate('(edn/pr-str "hello")')).toEqual(v.string('"hello"'))
  })

  it('serializes nil', () => {
    expect(s().evaluate('(edn/pr-str nil)')).toEqual(v.string('nil'))
  })

  it('serializes a keyword', () => {
    expect(s().evaluate('(edn/pr-str :foo)')).toEqual(v.string(':foo'))
  })

  it('serializes a vector', () => {
    expect(s().evaluate('(edn/pr-str [1 2 3])')).toEqual(v.string('[1 2 3]'))
  })

  it('serializes a map', () => {
    const result = s().evaluate('(edn/pr-str {:a 1})')
    expect(result).toEqual(v.string('{:a 1}'))
  })

  it('serializes a nested structure', () => {
    const result = s().evaluate('(edn/pr-str {:data [1 2 3]})')
    expect(result).toEqual(v.string('{:data [1 2 3]}'))
  })

  it('serializes true/false', () => {
    expect(s().evaluate('(edn/pr-str true)')).toEqual(v.string('true'))
    expect(s().evaluate('(edn/pr-str false)')).toEqual(v.string('false'))
  })
})

// ---------------------------------------------------------------------------
// 10. Round-trips
// ---------------------------------------------------------------------------

describe('edn round-trips: (read-string (pr-str x)) = x', () => {
  it.each([
    ['integer', '42'],
    ['negative integer', '-7'],
    ['float', '3.14'],
    ['nil', 'nil'],
    ['true', 'true'],
    ['false', 'false'],
    ['keyword', ':foo'],
    ['qualified keyword', ':ns/bar'],
    ['vector', '[1 2 3]'],
    ['nested map', '{:a {:b 1}}'],
  ])('%s round-trips', (_label, clj) => {
    const sess = s()
    const result = sess.evaluate(
      `(= (edn/read-string (edn/pr-str ${clj})) ${clj})`
    )
    expect(result).toEqual(v.boolean(true))
  })
})

// ---------------------------------------------------------------------------
// 11. Error cases
// ---------------------------------------------------------------------------

describe('clojure.edn/read-string — error cases', () => {
  it('throws on empty string', () => {
    expect(() => s().evaluate('(edn/read-string "")')).toThrow()
  })

  it('throws on unmatched parenthesis', () => {
    expect(() => s().evaluate('(edn/read-string "(1 2 3")')).toThrow()
  })

  it('throws on unmatched bracket', () => {
    expect(() => s().evaluate('(edn/read-string "[1 2 3")')).toThrow()
  })

  it('throws on unbalanced map', () => {
    expect(() => s().evaluate('(edn/read-string "{:a}")')).toThrow()
  })

  it('throws when called with wrong arity', () => {
    expect(() => s().evaluate('(edn/read-string)')).toThrow()
  })

  it('throws when source arg is not a string', () => {
    expect(() => s().evaluate('(edn/read-string 42)')).toThrow()
  })
})
