# @regibyte/cljam-schema

[![npm](https://img.shields.io/npm/v/%40regibyte%2Fcljam-schema)](https://www.npmjs.com/package/@regibyte/cljam-schema)
[![license](https://img.shields.io/npm/l/%40regibyte%2Fcljam-schema)](LICENSE)

Data-driven schema validation and JSON Schema generation for [@regibyte/cljam](https://www.npmjs.com/package/@regibyte/cljam). Inspired by [malli](https://github.com/metosin/malli).

Schemas are plain data — keywords for primitives, vectors for compound types. No classes, no builders, no DSL to learn.

***

## Installation

```bash
npm install @regibyte/cljam-schema
# peer dependency
npm install @regibyte/cljam
```

***

## Setup

```typescript
import { createSession, nodePreset } from '@regibyte/cljam'
import { library as schemaLib } from '@regibyte/cljam-schema'

const session = createSession({
  ...nodePreset(),
  libraries: [schemaLib],
})
```

Or via `root_dir` auto-loading — add to your `package.json`:

```json
{
  "cljam": {
    "libraries": ["@regibyte/cljam-schema"]
  }
}
```

***

## Usage

```clojure
(ns my-app.core
  (:require [cljam.schema.core :as s]))
```

### Validating primitives

```clojure
(s/validate :string "hello")   ;; {:ok true :value "hello"}
(s/validate :int 42)           ;; {:ok true :value 42}
(s/validate :int "oops")       ;; {:ok false :issues [{:error-code :int/wrong-type :path [] :schema :int}]}

(s/valid? :string "hello")     ;; true
(s/valid? :int "oops")         ;; false
```

Supported primitives: `:string` `:int` `:number` `:boolean` `:keyword` `:symbol` `:nil` `:any` `:uuid`

### Maps

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

Map entry format: `[key schema]` or `[key field-props schema]`. Field props control presence (`{:optional true}`). Schema controls the value type.

### Vectors, tuples, and maybe

```clojure
(s/validate [:vector :string] ["a" "b" "c"])
;; {:ok true :value ["a" "b" "c"]}

(s/validate [:tuple :string :int :boolean] ["hi" 1 true])
;; {:ok true :value ["hi" 1 true]}

(s/validate [:maybe :string] nil)
;; {:ok true :value nil}
```

### Enums, unions, and predicates

```clojure
(s/validate [:enum :red :green :blue] :red)
;; {:ok true :value :red}

(s/validate [:enum :red :green :blue] :purple)
;; {:ok false :issues [{:error-code :enum/no-match :path [] :schema [:enum :red :green :blue]}]}

(s/validate [:or :string :int] 42)
;; {:ok true :value 42}

(s/validate [:fn pos?] 5)
;; {:ok true :value 5}
```

### Homogeneous maps

```clojure
(s/validate [:map-of :keyword :int] {:a 1 :b 2})
;; {:ok true :value {:a 1 :b 2}}
```

***

## Human-readable errors with `explain`

`validate` returns bare `:error-code` keywords — branch on them in code. `explain` adds `:message` strings for display:

```clojure
(s/explain user-schema {:name 42 :age "not-a-number"})
;; {:ok false
;;  :issues [{:error-code :string/wrong-type :path [:name] :schema :string :message "expected a string"}
;;           {:error-code :int/wrong-type    :path [:age]  :schema :int    :message "expected an integer"}]}
```

### Custom messages

```clojure
(s/explain :int "oops" {:messages {:int/wrong-type "must be a whole number"}})
;; {:ok false :issues [{:error-code :int/wrong-type :path [] :schema :int :message "must be a whole number"}]}
```

***

## Nested schemas and path tracking

Errors carry the full path through vectors and maps:

```clojure
(def team-schema
  [:map
   [:name    :string]
   [:members [:vector [:map [:name :string] [:age :int]]]]])

(s/explain team-schema
  {:name "Dev"
   :members [{:name "Alice" :age 30}
             {:name "Bob"   :age "old"}]})
;; {:ok false
;;  :issues [{:error-code :int/wrong-type
;;            :path [:members 1 :age]
;;            :schema :int
;;            :message "expected an integer"}]}
```

`:path` is a vector of keys and indices — `[:members 1 :age]` means `members → index 1 → age`.

***

## JSON Schema generation

```clojure
(s/json-schema user-schema)
;; {:type "object"
;;  :properties {"name"  {:type "string"}
;;               "age"   {:type "integer"}
;;               "email" {:type "string"}}
;;  :required ["name" "age"]}
```

Nested schemas compile recursively. `[:map-of ...]` produces `additionalProperties`. `[:or ...]` produces `anyOf`.

***

## API Reference

| Function | Signature | Description |
|---|---|---|
| `validate` | `(schema value) → result` | Validate a value. Returns `{:ok true :value v}` or `{:ok false :issues [...]}` |
| `valid?` | `(schema value) → boolean` | Boolean shorthand for `validate` |
| `explain` | `(schema value), (schema value opts) → result` | Like `validate`, adds `:message` string to each issue |
| `json-schema` | `(schema) → map` | Compile schema to JSON Schema draft 2020-12 |

### Schema vocabulary

| Schema | Description |
|---|---|
| `:string` `:int` `:number` `:boolean` `:keyword` `:symbol` `:nil` `:any` `:uuid` | Primitive types |
| `[:map [key schema] ...]` | Map with named keys; field props `{:optional true}` |
| `[:map-of key-schema val-schema]` | Homogeneous map |
| `[:vector schema]` | Homogeneous vector |
| `[:tuple schema ...]` | Fixed-length vector, one schema per position |
| `[:maybe schema]` | Schema or nil |
| `[:or schema ...]` | Any one of the schemas |
| `[:and schema ...]` | All schemas must pass |
| `[:enum value ...]` | Exact value match |
| `[:fn pred]` | Custom predicate function |

### Error codes

| Code | Meaning |
|---|---|
| `:TYPE/wrong-type` | Value is the wrong type (e.g. `:int/wrong-type`) |
| `:map/missing-key` | Required map key absent |
| `:map/extra-key` | Unexpected key present |
| `:enum/no-match` | Value not in the enum |
| `:or/no-match` | Value matched none of the branches |
| `:tuple/wrong-length` | Tuple length mismatch |
| `:fn/predicate-failed` | Custom predicate returned false |

***

## License

MIT
