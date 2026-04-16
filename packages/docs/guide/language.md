# Language Reference

cljam is a Clojure dialect. Most Clojure code works as-is. This page covers the parts that differ from JVM Clojure, and a quick reference for the core stdlib.

## What's the same

- Immutable collections: vectors `[1 2 3]`, maps `{:a 1}`, sets `#{1 2}`, lists `'(1 2 3)`
- Namespaces: `ns`, `require`, `refer`, `alias`, `in-ns`
- Functions: `defn`, multi-arity, variadic `& args`
- Destructuring: sequential, associative, nested, `:keys`, `:strs`, `:syms`
- Macros: `defmacro`, quasiquote `` ` ``, unquote `~`, unquote-splicing `~@`
- Atoms: `atom`, `swap!`, `reset!`, `deref` / `@`
- `loop`/`recur` with tail-call optimization
- Multimethods: `defmulti`, `defmethod`, `prefer-method`
- Protocols and records: `defprotocol`, `defrecord`, `extend-protocol`, `extend-type`
- `try/catch/finally`, `throw`
- Transducers: `transduce`, `eduction`, `into` with xf arg
- Threading: `->`, `->>`, `as->`, `some->`, `cond->`
- Lazy sequences: `lazy-seq`, `map`, `filter`, `reduce`, `take`, `drop`, etc.
- `clojure.string`: `split`, `join`, `trim`, `upper-case`, `lower-case`, `replace`, etc.
- `clojure.edn`: `read-string`, reader tags `#inst` and `#uuid`
- `clojure.math`: `sqrt`, `pow`, `log`, `sin`, `cos`, `floor`, `ceil`, `PI`, etc.
- `clojure.test`: `deftest`, `is`, `testing`, `run-tests`, `use-fixtures`

## Character literals

```clojure
\a        ;; character a
\space    ;; space character
\newline  ;; newline
\tab      ;; tab
\u0041    ;; unicode: A
(char? \a)         ;; => true
(int \a)           ;; => 97
(char 65)          ;; => \A
(sort [\c \a \b])  ;; => [\a \b \c]
```

## Dynamic vars and `binding`

```clojure
(def ^:dynamic *db* nil)

(binding [*db* my-connection]
  (query! *db* "SELECT 1"))  ;; *db* is my-connection within this scope
```

`binding` is thread-local scoped — changes don't leak outside the block.

## Async and promises

cljam has two complementary styles for working with async values (`CljPending` — analogous to Promises):

### `(async ...)` + `@` — imperative style

`(async ...)` starts an async block. `@` inside the block awaits a pending value, like `await` in JS:

```clojure
(defn fetch-user [id]
  (async
    (let [resp @(. js/fetch (str "/users/" id))
          data @(. resp json)]
      data)))

;; Sequential awaits in let bindings
(async
  (let [a @(fetch-user 1)
        b @(fetch-user 2)]
    {:users [a b]}))
```

`@` outside an async block throws — it requires an async context.

### `then` / `catch*` — functional pipeline style

`then` and `catch*` compose pending values without an async block, like promise chaining:

```clojure
;; Transform a resolved value
(then (promise-of 5) #(* % 2))
;; => pending → resolves to 10

;; Chain with ->
(-> (promise-of 3)
    (then #(* % 2))        ;; → 6
    (then #(+ % 1)))       ;; → 7

;; Handle errors
(-> (async (throw {:type :oops}))
    (then  #(* % 2))        ;; skipped — upstream rejected
    (catch* #(:type %)))    ;; => :oops

;; Recover and continue
(-> (async (throw {:type :err}))
    (catch* (fn [_] 0))     ;; recovers with 0
    (then   #(+ % 5)))      ;; => 5
```

`then` is also a pass-through for non-pending values — useful for functions that may or may not be async.

### `all` — fan-out / parallel

```clojure
;; Like Promise.all — resolves when all pending values resolve
(async
  @(all [(fetch-user 1) (fetch-user 2) (fetch-user 3)]))
;; => [user1 user2 user3]

;; Works with a mix of pending and non-pending values
(async @(all [1 (promise-of 2) 3]))
;; => [1 2 3]
```

### Other async utilities

```clojure
(pending? (promise-of 1))   ;; => true
(pending? 42)               ;; => false
(promise-of {:x 1})        ;; wraps any value in a pending
```

## JS interop

```clojure
;; Method call: (. obj method args...)
(. js/Math pow 2 10)         ;; => 1024.0
(. js/console log "hello")

;; Property access: (. obj prop) — zero extra args
(. js/Math PI)               ;; => 3.141592653589793
(def now (js/new js/Date))
(. now toISOString)          ;; => "2026-04-14T..."

;; Injected host values (hostBindings: { path: require('node:path') })
(. js/path join "a" "b")    ;; => "a/b"
```

Property access uses `(. obj propName)` with zero extra args — never `-propName` (that's ClojureScript convention, not cljam).

For dynamic property access, use `js/get`:

```clojure
(js/get js/Math "PI")                     ;; => 3.141592...
(js/get-in js/obj ["nested" "key"])       ;; deep access
(js/call js/fn 1 2 3)                     ;; call with no this binding
(js/set! js/obj "key" value)             ;; mutate a property
```

## `catch` discriminators

No exception class hierarchy — `catch` uses keywords or predicates:

```clojure
(try
  (risky-fn)
  (catch :validation/error e
    (println "validation failed:" (:field e)))
  (catch :not-found e
    (println "not found:" (:id e)))
  (catch :default e
    (println "unknown error" e)))
```

`:default` catches anything not matched by earlier branches.

### Throwing structured errors

There are two complementary patterns:

**Pattern 1 — plain map throw + typed catch**

Put `:type` at the top level of the map. The `catch` discriminator matches against it directly:

```clojure
(throw {:type :validation/error :message "Validation failed" :field :age :value -1})

(try
  (validate! user)
  (catch :validation/error e
    (println (:message e))  ;; => "Validation failed"
    (println (:field e))))  ;; => :age
```

**Pattern 2 — `ex-info` throw + `:default` catch**

`ex-info` stores data under `:data`, so use `ex-message`/`ex-data` to inspect it:

```clojure
(throw (ex-info "Validation failed" {:field :age :value -1}))

(try
  (validate! user)
  (catch :default e
    (println (ex-message e))         ;; => "Validation failed"
    (println (:field (ex-data e))))) ;; => :age
```

:::info ex-info structure
`(ex-info msg data)` returns `{:message msg :data data}`. The keyword `catch` discriminator checks for `:type` at the **top level** of the thrown value — it does not look inside `:data`. Use Pattern 1 when you need typed catching, Pattern 2 when you want the message/data split.
:::

### Async error handling

Errors in async blocks propagate through `then`/`catch*` chains:

```clojure
;; try/catch inside (async ...) — catches @ rejections
(async
  (try
    (let [result @(might-fail)]
      result)
    (catch :default e
      {:error (:type e)})))

;; catch* at the pipeline level
(-> (fetch-data)
    (then  process)
    (catch* (fn [e] {:error e :fallback true})))
```

## What's different from JVM Clojure

| Feature | JVM Clojure | cljam |
|---|---|---|
| Java interop | `.method`, `new Foo`, `import` | Use `js/` namespace |
| `defrecord` / `defprotocol` | Java class dispatch | Keyword type tag dispatch (`:user/MyRecord`) |
| `deftype` | Available | Not implemented |
| `future` / `agent` | Available | Use `(async ...)` instead |
| Numbers | `Long`, `BigDecimal`, ratios | IEEE-754 floats only |
| `##NaN` / `##Inf` reader literals | Available | Not yet — use `(clojure.math/sqrt -1)` |
| `import` | Java class import | Not available |

## Standard namespaces

All available without installation:

| Namespace | Notable functions |
|---|---|
| `clojure.core` | Everything. Loaded automatically. |
| `clojure.string` | `split`, `join`, `trim`, `replace`, `starts-with?`, `ends-with?` |
| `clojure.edn` | `read-string`, `pr-str` |
| `clojure.math` | `sqrt`, `pow`, `log`, `sin`, `cos`, `floor`, `ceil`, `PI`, `E` |
| `clojure.test` | `deftest`, `is`, `testing`, `run-tests`, `use-fixtures` |
