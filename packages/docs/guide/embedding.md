# Embedding

## Presets

Three presets control what the session can access:

```typescript
import { createSession, nodePreset, sandboxPreset, browserPreset } from '@regibyte/cljam'

// Full Node.js: console, process, fetch, dynamic import
const session = createSession({ ...nodePreset() })

// Browser: DOM globals, fetch
const session = createSession({ ...browserPreset() })

// Locked down: Math only, no I/O, no imports
const session = createSession({ ...sandboxPreset() })
```

## Injecting host values with `hostBindings`

`hostBindings` makes any TypeScript value available as `js/<key>` in Clojure:

```typescript
import { createSession, sandboxPreset } from '@regibyte/cljam'

const session = createSession({
  ...sandboxPreset(),
  hostBindings: {
    db: {
      findUser: (id: number) => ({ id, name: 'Alice' }),
      users: ['Alice', 'Bob'],
    },
  },
})
```

```clojure
;; Method call — (. obj method args...) — like JS: db.findUser(42)
(. js/db findUser 42)
;; => {:id 42 :name "Alice"}

;; Property access
(js/get js/db "users")
;; => ["Alice" "Bob"]
```

Objects, functions, arrays, and primitives all work. Non-primitive JS values are boxed as `CljJsValue` and cross back out automatically at call boundaries.

:::warning Reserved names
`hostBindings` keys cannot shadow built-in `js/` functions: `get`, `set!`, `call`, `merge`, `get-in`, `apply`, `obj`, `array`, `seq`, `prop`, `method`, `typeof`. Attempting to do so throws at session creation time.
:::

## JS namespace utilities

Beyond the `(. obj method args...)` special form, the `js/` namespace has utilities:

```clojure
;; Read a property
(js/get js/obj "key")               ;; obj["key"]
(js/get js/obj "key" "fallback")    ;; obj["key"] ?? "fallback"
(js/get-in js/obj ["a" "b" "c"])    ;; obj.a.b.c

;; Call a bare function (no this binding)
(js/call js/fn 1 2 3)               ;; fn(1, 2, 3)

;; Mutate a property
(js/set! js/obj "key" value)        ;; obj["key"] = value

;; Build JS values from Clojure
(js/obj "a" 1 "b" 2)               ;; { a: 1, b: 2 }
(js/array 1 2 3)                    ;; [1, 2, 3]
(js/merge js/target {:extra true})  ;; Object.assign({}, target, { extra: true })
```

## Loading string modules with `importModule`

`importModule` powers `(:require ["specifier" :as alias])` — JS module loading inside Clojure `ns` forms:

```typescript
const session = createSession({
  ...nodePreset(),
  importModule: (specifier) => import(specifier),
})
```

```clojure
(ns my-app.core
  (:require ["node:path" :as path]))

(. path join "src" "components" "App.tsx")
;; => "src/components/App.tsx"

(. path dirname "/usr/local/bin/cljam")
;; => "/usr/local/bin"
```

`importModule` is async — the `ns` form must be processed with `evaluateAsync`. Once a module is loaded into the session, it stays cached and subsequent `evaluate` calls are synchronous.

## Loading libraries

```typescript
import { createSession, nodePreset } from '@regibyte/cljam'
import { library as schemaLib } from '@regibyte/cljam-schema'
import { library as dateLib } from '@regibyte/cljam-date'

const session = createSession({
  ...nodePreset(),
  libraries: [schemaLib, dateLib],
})
```

## Capturing output

```typescript
const output: string[] = []

const session = createSession({
  ...sandboxPreset(),
  output: (text) => output.push(text),
})

session.evaluate('(println "hello world")')
console.log(output) // ["hello world"]
```

## Session options reference

| Option | Type | Description |
|---|---|---|
| `output` | `(text: string) => void` | Receives `println`/`print`/`pprint` output |
| `stderr` | `(text: string) => void` | Receives error output |
| `hostBindings` | `Record<string, unknown>` | Values accessible as `js/<key>` in Clojure |
| `importModule` | `(specifier: string) => unknown \| Promise<unknown>` | Resolves `(:require ["specifier"])` |
| `libraries` | `CljamLibrary[]` | Extra Clojure namespaces to pre-load |
| `allowedPackages` | `string[]` \| `'all'` | Which library namespaces `require` can load |
| `allowedHostModules` | `string[]` \| `'all'` | Which JS module specifiers `importModule` can load |
| `sourceRoots` | `string[]` | Directories where `.clj` files are resolved |
| `readFile` | `(filePath: string) => string` | How to read `.clj` source files |
