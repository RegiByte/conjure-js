# cljam-schema

[![npm](https://img.shields.io/npm/v/%40regibyte%2Fcljam-schema)](https://www.npmjs.com/package/@regibyte/cljam-schema)

Data-driven schema validation and JSON Schema generation. Inspired by [malli](https://github.com/metosin/malli). Schemas are plain data — no classes, no builders.

## Installation

```bash
npm install @regibyte/cljam-schema
```

```typescript
import { createSession, nodePreset } from '@regibyte/cljam'
import { library as schemaLib } from '@regibyte/cljam-schema'

const session = createSession({ ...nodePreset(), libraries: [schemaLib] })
```

Or add to `package.json` for auto-loading:

```json
{ "cljam": { "libraries": ["@regibyte/cljam-schema"] } }
```

## Basic validation

```clojure
(require '[cljam.schema.core :as s])

(s/validate :string "hello")   ;; {:ok true :value "hello"}
(s/validate :int "oops")       ;; {:ok false :issues [{:error-code :int/wrong-type ...}]}
(s/valid? :string "hello")     ;; true
```

Primitives: `:string` `:int` `:number` `:boolean` `:keyword` `:symbol` `:nil` `:any` `:uuid`

## Maps

```clojure
(def user-schema
  [:map
   [:name  :string]
   [:age   :int]
   [:email {:optional true} :string]])

(s/validate user-schema {:name "Alice" :age 30})
;; {:ok true :value {:name "Alice" :age 30}}

(s/validate user-schema {:name "Alice"})
;; {:ok false :issues [{:error-code :map/missing-key :path [:age] :schema :int}]}
```

## Compound schemas

```clojure
;; Vector, tuple, maybe
(s/validate [:vector :string] ["a" "b"])
(s/validate [:tuple :string :int] ["hi" 1])
(s/validate [:maybe :string] nil)           ;; passes

;; Enum, union, predicate
(s/validate [:enum :red :green :blue] :red)
(s/validate [:or :string :int] 42)
(s/validate [:fn pos?] 5)

;; Intersection — all schemas must pass
(s/validate [:and :int [:fn pos?]] 5)    ;; {:ok true  :value 5}
(s/validate [:and :int [:fn pos?]] -2)   ;; {:ok false :issues [{:error-code :fn/predicate-failed ...}]}

;; Homogeneous map
(s/validate [:map-of :keyword :int] {:a 1 :b 2})
```

## Human-readable errors

```clojure
(s/explain user-schema {:name 42 :age "not-a-number"})
;; {:ok false
;;  :issues [{:error-code :string/wrong-type :path [:name] :message "expected a string"}
;;           {:error-code :int/wrong-type    :path [:age]  :message "expected an integer"}]}
```

Custom messages:

```clojure
(s/explain :int "oops" {:messages {:int/wrong-type "must be a whole number"}})
```

## Nested errors with path tracking

```clojure
(def team-schema
  [:map
   [:name    :string]
   [:members [:vector [:map [:name :string] [:age :int]]]]])

(s/explain team-schema {:name "Dev" :members [{:name "Bob" :age "old"}]})
;; {:issues [{:error-code :int/wrong-type :path [:members 0 :age] ...}]}
```

## JSON Schema output

```clojure
(s/json-schema user-schema)
;; {:type "object"
;;  :properties {"name" {:type "string"} "age" {:type "integer"} "email" {:type "string"}}
;;  :required ["name" "age"]}
```

## API

| Function | Description |
|---|---|
| `(s/validate schema value)` | Returns `{:ok true :value v}` or `{:ok false :issues [...]}` |
| `(s/valid? schema value)` | Boolean shorthand |
| `(s/explain schema value)` | Like validate, adds `:message` string to each issue |
| `(s/explain schema value opts)` | With `{:messages {:code "..."}}` overrides |
| `(s/json-schema schema)` | JSON Schema draft 2020-12 as a Clojure map |

## Error codes

`:TYPE/wrong-type` — `:map/missing-key` — `:map/extra-key` — `:enum/no-match` — `:or/no-match` — `:tuple/wrong-length` — `:fn/predicate-failed`

## Known limitations

**`[:and ...]` short-circuit:** When a type branch fails inside `[:and :type [:fn pred]]`, the predicate still runs on the wrong-typed value and may throw `:fn/predicate-threw` instead of stopping at the type failure. Workaround: inline the type check in the predicate:

```clojure
;; Instead of:  [:and :int [:fn pos?]]
;; Use:
[:fn #(and (int? %) (pos? %))]
```
