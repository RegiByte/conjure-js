# Building Libraries

A cljam library is a TypeScript package that bundles Clojure namespaces and/or native runtime modules. The `cljam gen-lib-source` command generates the sources map.

## Quickstart

```bash
mkdir my-cljam-lib && cd my-cljam-lib
npm init -y
npm install --save-dev @regibyte/cljam
```

Add to `package.json`:

```json
{
  "scripts": {
    "gen:sources": "cljam gen-lib-source src/clojure src/generated/sources.ts",
    "prepublishOnly": "npm run gen:sources"
  }
}
```

Create your Clojure namespace:

```clojure
;; src/clojure/my-lib/core.clj
(ns my-lib.core)

(defn greet [name]
  (str "Hello, " name "!"))
```

Create the library manifest:

```typescript
// my-lib.ts
import type { CljamLibrary } from '@regibyte/cljam'
import { sources } from './src/generated/sources.js'

export const library: CljamLibrary = {
  id: 'my-lib',
  sources,
}
```

Run `npm run gen:sources` — this generates `src/generated/sources.ts` with your Clojure source embedded as strings.

## Using your library

```typescript
import { createSession, nodePreset } from '@regibyte/cljam'
import { library as myLib } from 'my-cljam-lib'

const session = createSession({
  ...nodePreset(),
  libraries: [myLib],
})

session.evaluate("(require '[my-lib.core :as lib])")
session.evaluate('(lib/greet "world")')  // => "Hello, world!"
```

## Native modules

To wrap JavaScript APIs, define a `RuntimeModule` and attach it to your library as `module`. The module declares namespaces and the vars they expose using `declareNs`:

```typescript
import { v } from '@regibyte/cljam'
import type { CljamLibrary, RuntimeModule, VarMap } from '@regibyte/cljam'
import { sources } from './src/generated/sources.js'

const nativeModule: RuntimeModule = {
  id: 'my-lib/native',
  declareNs: [
    {
      name: 'my-lib.native',
      vars(_ctx): VarMap {
        const map = new Map()

        map.set('add', {
          value: v.nativeFn('my-lib.native/add', ([a, b]) => {
            // args are CljValue — check kinds, return CljValue
            return v.number((a as any).value + (b as any).value)
          }),
        })

        return map
      },
    },
  ],
}

export const library: CljamLibrary = {
  id: 'my-lib',
  sources,
  module: nativeModule,
}
```

```clojure
;; In Clojure, require the native namespace directly
(require '[my-lib.native :as native])
(native/add 1 2)  ;; => 3
```

`vars` receives a `ModuleContext` that lets you read already-installed namespaces (`ctx.getVar`, `ctx.getNamespace`) — useful when one native module depends on another. Use `dependsOn: ['clojure.core']` to guarantee install order.

See `@regibyte/cljam-date` (`packages/cljam-date/src/native.ts`) as a reference implementation.

## Auto-loading via package.json

Libraries registered in `cljam.libraries` are loaded automatically when a session is created with `--root-dir`:

```json
{
  "cljam": {
    "libraries": ["my-cljam-lib", "./packages/my-local-lib"]
  }
}
```

Each package must export a `library` named export conforming to `CljamLibrary`.
