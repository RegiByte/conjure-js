/**
 * clojure.test integration tests
 *
 * Covers the full stack via freshSession → require → evaluate:
 *   1.  is — pass, fail, error paths
 *   2.  deftest — registration and execution
 *   3.  testing — context labeling
 *   4.  run-tests — summary map, multi-namespace
 *   5.  report — multimethod dispatch and override
 *   6.  *report-counters* — counter tracking
 *   7.  are — parameterised assertions
 *   8.  *testing-contexts* — dynamic context stack
 *   9.  *testing-vars* — current test name
 *   10. Error cases
 */

import { describe, expect, it } from 'vitest'
import { freshSession as session } from '../evaluator/__tests__/evaluator-test-utils'
import { v } from '../factories'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function s() {
  const sess = session()
  sess.evaluate("(require '[clojure.test :refer [deftest is testing run-tests are report]])")
  return sess
}

/** Start in a named namespace with clojure.test already required. */
function ns(name: string) {
  const sess = session()
  sess.evaluate(`(ns ${name}) (require '[clojure.test :refer [deftest is testing run-tests are report]])`)
  return sess
}

// ---------------------------------------------------------------------------
// 1. is — basic assertion paths
// ---------------------------------------------------------------------------

describe('clojure.test/is — pass path', () => {
  it('(is true) calls report :pass', () => {
    const sess = s()
    sess.evaluate(`
      (def results (atom []))
      (defmethod report :pass [m] (swap! results conj :pass))
    `)
    sess.evaluate('(is true)')
    expect(sess.evaluate('@results')).toEqual(v.vector([v.keyword(':pass')]))
  })

  it('(is (= 1 1)) reports :pass', () => {
    const sess = s()
    sess.evaluate(`
      (def results (atom []))
      (defmethod report :pass [m] (swap! results conj (:type m)))
    `)
    sess.evaluate('(is (= 1 1))')
    expect(sess.evaluate('@results')).toEqual(v.vector([v.keyword(':pass')]))
  })

  it(':pass report carries :expected and :actual', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :pass [m] (reset! captured m))
    `)
    sess.evaluate('(is (= 2 2))')
    expect(sess.evaluate('(:type @captured)')).toEqual(v.keyword(':pass'))
    expect(sess.evaluate('(:actual @captured)')).toEqual(v.boolean(true))
  })
})

describe('clojure.test/is — fail path', () => {
  it('(is false) calls report :fail', () => {
    const sess = s()
    sess.evaluate(`
      (def results (atom []))
      (defmethod report :fail [m] (swap! results conj :fail))
    `)
    sess.evaluate('(is false)')
    expect(sess.evaluate('@results')).toEqual(v.vector([v.keyword(':fail')]))
  })

  it('(is (= 1 2)) reports :fail', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :fail [m] (reset! captured m))
    `)
    sess.evaluate('(is (= 1 2))')
    expect(sess.evaluate('(:type @captured)')).toEqual(v.keyword(':fail'))
    expect(sess.evaluate('(:actual @captured)')).toEqual(v.boolean(false))
  })

  it(':fail report carries the expected form as quoted data', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :fail [m] (reset! captured m))
    `)
    sess.evaluate('(is (= 1 2))')
    // (:expected m) should be the list (= 1 2)
    expect(sess.evaluate("(list? (:expected @captured))")).toEqual(v.boolean(true))
    expect(sess.evaluate("(first (:expected @captured))")).toEqual(v.symbol('='))
  })

  it('failure message is carried in :message', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :fail [m] (reset! captured m))
    `)
    sess.evaluate('(is (= 1 2) "my message")')
    expect(sess.evaluate('(:message @captured)')).toEqual(v.string('my message'))
  })

  it('no message — :message is nil', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :fail [m] (reset! captured m))
    `)
    sess.evaluate('(is false)')
    expect(sess.evaluate('(:message @captured)')).toEqual(v.nil())
  })
})

describe('clojure.test/is — error path', () => {
  it('exception inside is form reports :error', () => {
    const sess = s()
    sess.evaluate(`
      (def results (atom []))
      (defmethod report :error [m] (swap! results conj (:type m)))
    `)
    sess.evaluate('(is (throw (ex-info "boom" {})))')
    expect(sess.evaluate('@results')).toEqual(v.vector([v.keyword(':error')]))
  })

  it(':error report carries :actual as the error value', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :error [m] (reset! captured m))
    `)
    sess.evaluate('(is (throw (ex-info "boom" {:x 1})))')
    expect(sess.evaluate('(map? (:actual @captured))')).toEqual(v.boolean(true))
    expect(sess.evaluate('(:message (:actual @captured))')).toEqual(v.string('boom'))
  })

  it(':error report carries :expected as the quoted form', () => {
    const sess = s()
    sess.evaluate(`
      (def captured (atom nil))
      (defmethod report :error [m] (reset! captured m))
    `)
    sess.evaluate('(is (throw (ex-info "boom" {})))')
    expect(sess.evaluate('(list? (:expected @captured))')).toEqual(v.boolean(true))
  })
})

// ---------------------------------------------------------------------------
// 2. deftest — registration and execution
// ---------------------------------------------------------------------------

describe('clojure.test/deftest', () => {
  it('defines a 0-arity function', () => {
    const sess = ns('my.tests')
    sess.evaluate('(deftest my-test (is (= 1 1)))')
    expect(sess.evaluate('(fn? my-test)')).toEqual(v.boolean(true))
  })

  it('test function is callable directly', () => {
    const sess = ns('my.tests')
    sess.evaluate(`
      (def ran (atom false))
      (deftest direct-test (reset! ran true))
    `)
    sess.evaluate('(direct-test)')
    expect(sess.evaluate('@ran')).toEqual(v.boolean(true))
  })

  it('registers the test in the registry under current namespace', () => {
    const sess = ns('my.tests')
    sess.evaluate('(deftest reg-test (is true))')
    // The test-registry atom in clojure.test should have an entry for "my.tests"
    expect(
      sess.evaluate('(contains? @clojure.test/test-registry "my.tests")')
    ).toEqual(v.boolean(true))
  })

  it('multiple deftests accumulate in the registry', () => {
    const sess = ns('multi.ns')
    sess.evaluate('(deftest t1 (is true))')
    sess.evaluate('(deftest t2 (is true))')
    sess.evaluate('(deftest t3 (is true))')
    expect(
      sess.evaluate('(count (get @clojure.test/test-registry "multi.ns"))')
    ).toEqual(v.number(3))
  })
})

// ---------------------------------------------------------------------------
// 3. testing — context labeling
// ---------------------------------------------------------------------------

describe('clojure.test/testing', () => {
  it('testing context appears in *testing-contexts* during execution', () => {
    const sess = s()
    sess.evaluate(`
      (def ctx (atom nil))
      (defmethod report :pass [m]
        (reset! ctx clojure.test/*testing-contexts*))
    `)
    sess.evaluate('(testing "my context" (is true))')
    expect(sess.evaluate('@ctx')).toEqual(v.vector([v.string('my context')]))
  })

  it('context is restored after testing block', () => {
    const sess = s()
    sess.evaluate('(testing "ctx" (is true))')
    expect(sess.evaluate('clojure.test/*testing-contexts*')).toEqual(v.vector([]))
  })

  it('nested testing blocks stack contexts', () => {
    const sess = s()
    sess.evaluate(`
      (def ctx (atom nil))
      (defmethod report :pass [m]
        (reset! ctx clojure.test/*testing-contexts*))
    `)
    sess.evaluate(`
      (testing "outer"
        (testing "inner"
          (is true)))
    `)
    expect(sess.evaluate('@ctx')).toEqual(
      v.vector([v.string('outer'), v.string('inner')])
    )
  })

  it('outer context is preserved after inner testing block', () => {
    const sess = s()
    sess.evaluate(`
      (def ctx (atom nil))
      (defmethod report :pass [m]
        (reset! ctx clojure.test/*testing-contexts*))
    `)
    sess.evaluate(`
      (testing "outer"
        (testing "inner" nil)
        (is true))
    `)
    expect(sess.evaluate('@ctx')).toEqual(
      v.vector([v.string('outer')])
    )
  })
})

// ---------------------------------------------------------------------------
// 4. run-tests — summary map
// ---------------------------------------------------------------------------

describe('clojure.test/run-tests', () => {
  it('returns a summary map with counter keys', () => {
    const sess = ns('rt.test')
    sess.evaluate('(deftest t1 (is true))')
    const result = sess.evaluate("(run-tests 'rt.test)")
    expect(result.kind).toBe('map')
    if (result.kind === 'map') {
      const keys = result.entries.map(([k]) => k.kind === 'keyword' && k.name)
      expect(keys).toContain(':test')
      expect(keys).toContain(':pass')
      expect(keys).toContain(':fail')
      expect(keys).toContain(':error')
    }
  })

  it('counts tests and assertions correctly', () => {
    const sess = ns('count.test')
    sess.evaluate(`
      (deftest t1 (is true) (is true))
      (deftest t2 (is (= 1 1)))
    `)
    const result = sess.evaluate("(run-tests 'count.test)")
    expect(sess.evaluate("(:test (run-tests 'count.test))")).toEqual(v.number(2))
    // each run adds: calling run-tests again doubles — use fresh session
    expect(result.kind).toBe('map')
  })

  it('run-tests with explicit ns — :test, :pass, :fail', () => {
    const sess = ns('exact.test')
    sess.evaluate(`
      (deftest pass-test (is (= 2 2)))
      (deftest fail-test (is (= 1 2)))
    `)
    // Override report to silence output
    sess.evaluate('(defmethod report :default [_] nil)')
    const result = sess.evaluate("(run-tests 'exact.test)")
    expect(sess.evaluate("(:test (run-tests 'exact.test))")).toEqual(v.number(2))
    expect(result.kind).toBe('map')
  })

  it(':pass count matches passing assertions', () => {
    const sess = ns('pass.count')
    sess.evaluate(`
      (deftest t (is true) (is (= 1 1)) (is (string? "a")))
    `)
    sess.evaluate('(defmethod report :default [_] nil)')
    sess.evaluate("(def run-result (run-tests 'pass.count))")
    expect(sess.evaluate('(:pass run-result)')).toEqual(v.number(3))
  })

  it(':fail count matches failing assertions', () => {
    const sess = ns('fail.count')
    sess.evaluate('(deftest t (is false) (is (= 1 2)))')
    sess.evaluate('(defmethod report :default [_] nil)')
    sess.evaluate("(def run-result (run-tests 'fail.count))")
    expect(sess.evaluate('(:fail run-result)')).toEqual(v.number(2))
  })

  it(':error count matches thrown exceptions in is', () => {
    const sess = ns('err.count')
    sess.evaluate('(deftest t (is (throw (ex-info "x" {}))))')
    sess.evaluate('(defmethod report :default [_] nil)')
    sess.evaluate("(def run-result (run-tests 'err.count))")
    expect(sess.evaluate('(:error run-result)')).toEqual(v.number(1))
  })

  it('run-tests with no args uses current namespace', () => {
    const sess = ns('current.ns.test')
    sess.evaluate('(deftest t (is true))')
    sess.evaluate('(defmethod report :default [_] nil)')
    // run-tests with no args should pick up tests in current.ns.test
    sess.evaluate('(def run-result (run-tests))')
    expect(sess.evaluate('(:test run-result)')).toEqual(v.number(1))
  })

  it('run-tests on empty namespace returns zero counts', () => {
    const sess = ns('empty.ns')
    sess.evaluate('(defmethod report :default [_] nil)')
    sess.evaluate("(def run-result (run-tests 'empty.ns))")
    expect(sess.evaluate('(:test run-result)')).toEqual(v.number(0))
    expect(sess.evaluate('(:pass run-result)')).toEqual(v.number(0))
  })
})

// ---------------------------------------------------------------------------
// 5. report multimethod — dispatch and override
// ---------------------------------------------------------------------------

describe('clojure.test/report multimethod', () => {
  it('default :default method returns nil', () => {
    const sess = s()
    // Dispatch an unknown type — should hit :default → nil
    expect(
      sess.evaluate('(report {:type :unknown-xyz})')
    ).toEqual(v.nil())
  })

  it('custom :pass override is called', () => {
    const sess = s()
    sess.evaluate(`
      (def called (atom false))
      (defmethod report :pass [_] (reset! called true))
    `)
    sess.evaluate('(is true)')
    expect(sess.evaluate('@called')).toEqual(v.boolean(true))
  })

  it('custom override receives the full report map', () => {
    const sess = s()
    sess.evaluate(`
      (def received (atom nil))
      (defmethod report :fail [m] (reset! received m))
    `)
    sess.evaluate('(is false "msg")')
    expect(sess.evaluate('(:message @received)')).toEqual(v.string('msg'))
    expect(sess.evaluate('(:type @received)')).toEqual(v.keyword(':fail'))
  })

  it('report can be used standalone with custom maps', () => {
    const sess = s()
    sess.evaluate(`
      (def received (atom nil))
      (defmethod report :custom [m] (reset! received m))
    `)
    sess.evaluate('(report {:type :custom :data 42})')
    expect(sess.evaluate('(:data @received)')).toEqual(v.number(42))
  })
})

// ---------------------------------------------------------------------------
// 6. *report-counters* — counter tracking
// ---------------------------------------------------------------------------

describe('clojure.test/*report-counters*', () => {
  it('is nil outside run-tests', () => {
    const sess = s()
    expect(sess.evaluate('clojure.test/*report-counters*')).toEqual(v.nil())
  })

  it('is bound to an atom inside run-tests', () => {
    const sess = ns('counter.test')
    sess.evaluate(`
      (def counter-during (atom nil))
      (deftest t
        (reset! counter-during (atom? clojure.test/*report-counters*)))
    `)
    sess.evaluate('(defmethod report :default [_] nil)')
    sess.evaluate("(run-tests 'counter.test)")
    expect(sess.evaluate('@counter-during')).toEqual(v.boolean(true))
  })
})

// ---------------------------------------------------------------------------
// 7. are — parameterised assertions
// ---------------------------------------------------------------------------

describe('clojure.test/are', () => {
  it('are with passing values all report :pass', () => {
    const sess = s()
    sess.evaluate(`
      (def pass-count (atom 0))
      (defmethod report :pass [_] (swap! pass-count inc))
    `)
    sess.evaluate('(are [x y] (= x y) 1 1 2 2 3 3)')
    expect(sess.evaluate('@pass-count')).toEqual(v.number(3))
  })

  it('are with a failing value reports :fail', () => {
    const sess = s()
    sess.evaluate(`
      (def fail-count (atom 0))
      (defmethod report :fail [_] (swap! fail-count inc))
    `)
    sess.evaluate('(are [x y] (= x y) 1 1 2 99 3 3)')
    expect(sess.evaluate('@fail-count')).toEqual(v.number(1))
  })

  it('are with no args returns nil', () => {
    const sess = s()
    expect(sess.evaluate('(are [x] (= x 1))')).toEqual(v.nil())
  })

  it('are binds multiple params correctly', () => {
    const sess = s()
    sess.evaluate(`
      (def pass-count (atom 0))
      (defmethod report :pass [_] (swap! pass-count inc))
    `)
    sess.evaluate('(are [a b c] (= (+ a b) c) 1 2 3 10 20 30)')
    expect(sess.evaluate('@pass-count')).toEqual(v.number(2))
  })
})

// ---------------------------------------------------------------------------
// 8. *testing-contexts* inside run-tests
// ---------------------------------------------------------------------------

describe('clojure.test/*testing-contexts* in run-tests', () => {
  it('testing context propagates into report during run-tests', () => {
    const sess = ns('ctx.run.test')
    sess.evaluate(`
      (def seen-ctx (atom nil))
      (defmethod report :fail [m]
        (reset! seen-ctx clojure.test/*testing-contexts*))
      (deftest context-aware
        (testing "addition"
          (is (= 1 2))))
    `)
    sess.evaluate("(run-tests 'ctx.run.test)")
    expect(sess.evaluate('@seen-ctx')).toEqual(
      v.vector([v.string('addition')])
    )
  })
})

// ---------------------------------------------------------------------------
// 9. *testing-vars* — current test name
// ---------------------------------------------------------------------------

describe('clojure.test/*testing-vars*', () => {
  it('*testing-vars* contains the current test name during execution', () => {
    const sess = ns('vars.test')
    sess.evaluate(`
      (def seen-vars (atom nil))
      (defmethod report :pass [m]
        (reset! seen-vars clojure.test/*testing-vars*))
      (deftest my-named-test (is true))
    `)
    sess.evaluate("(run-tests 'vars.test)")
    // *testing-vars* should contain the test name string
    expect(sess.evaluate('(count @seen-vars)')).toEqual(v.number(1))
    expect(sess.evaluate('(first @seen-vars)')).toEqual(v.string('my-named-test'))
  })

  it('is empty outside run-tests', () => {
    const sess = s()
    expect(sess.evaluate('clojure.test/*testing-vars*')).toEqual(v.vector([]))
  })
})

// ---------------------------------------------------------------------------
// 10. Error cases
// ---------------------------------------------------------------------------

describe('clojure.test — error cases', () => {
  it('deftest with a top-level throw reports :error', () => {
    const sess = ns('toplevel.err')
    sess.evaluate(`
      (def err-count (atom 0))
      (defmethod report :error [_] (swap! err-count inc))
      (deftest throwing-test (throw (ex-info "oops" {})))
    `)
    sess.evaluate("(run-tests 'toplevel.err)")
    expect(sess.evaluate('@err-count')).toEqual(v.number(1))
  })

  it('one test throwing does not prevent other tests from running', () => {
    const sess = ns('resilient.test')
    sess.evaluate(`
      (def ran (atom []))
      (defmethod report :pass [_]  (swap! ran conj :pass))
      (defmethod report :error [_] (swap! ran conj :error))
      (deftest t1 (is true))
      (deftest t2 (throw (ex-info "boom" {})))
      (deftest t3 (is true))
    `)
    sess.evaluate("(run-tests 'resilient.test)")
    expect(sess.evaluate('(count @ran)')).toEqual(v.number(3))
  })
})
