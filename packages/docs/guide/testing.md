# Testing

cljam ships `clojure.test` as a built-in namespace. You can run tests with the native runner, with Vitest, or with Bun.

## Writing tests

```clojure
(ns my-app.core-test
  (:require [clojure.test :refer [deftest is testing run-tests thrown? thrown-with-msg?]]))

(deftest addition-works
  (is (= 4 (+ 2 2)))
  (is (not (= 4 (+ 2 3)))))

(deftest string-ops
  (testing "concatenation"
    (is (= "hello world" (str "hello " "world"))))
  (testing "length"
    (is (= 5 (count "hello")))))

(run-tests 'my-app.core-test)
;; {:test 2 :pass 3 :fail 0 :error 0}
```

## Vitest integration

`*.test.clj` and `*.spec.clj` files run as native Vitest tests via `cljTestPlugin()`:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { cljTestPlugin } from '@regibyte/cljam/vite-plugin'

export default defineConfig({
  plugins: [cljTestPlugin()],
  test: {
    include: ['**/*.{test,spec}.{ts,clj}'],
  },
})
```

Then just run `vitest` — your `.test.clj` files are picked up automatically.

`cljTestPlugin` accepts an optional `entrypoint` to seed sessions with custom `hostBindings`, `allowedPackages`, or `libraries`:

```typescript
import { cljTestPlugin } from '@regibyte/cljam/vite-plugin'

// src/test-session.ts
export default function() {
  return { hostBindings: { db: myTestDb } }
}

// vitest.config.ts
plugins: [cljTestPlugin({ sourceRoots: ['src'], entrypoint: 'src/test-session.ts' })]
```

## Async tests

```clojure
(deftest async-op-works
  (async
    (let [result @(my-async-fn 42)]
      (is (= 84 result)))))
```

Use `(async ...)` inside `deftest` for async work. `@` inside the block awaits the value.

## Fixtures

```clojure
(use-fixtures :each
  (fn [test-fn]
    (setup-db!)
    (test-fn)
    (teardown-db!)))
```

`:each` fixtures run before and after every test in the namespace. The native `run-tests` runner and the Vitest codegen both apply `:each` fixtures correctly.

## Assertions

| Form | Description |
|---|---|
| `(is (= expected actual))` | Equality check |
| `(is (thrown? :error-key (expr)))` | Expects a throw with that keyword |
| `(is (thrown-with-msg? :key #"regex" (expr)))` | Throw + message matches regex |
| `(testing "label" ...)` | Group assertions with a label in failure output |
| `(are [x y] (= x y) 1 1, 2 2)` | Tabular assertions |
