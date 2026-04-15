# cljam-integrant

[![npm](https://img.shields.io/npm/v/%40regibyte%2Fcljam-integrant)](https://www.npmjs.com/package/@regibyte/cljam-integrant)

Data-driven system composition for cljam. A port of [Integrant](https://github.com/weavejester/integrant).

Define your system as a data map. Integrant resolves dependencies, starts components in topological order, and stops them in reverse. All lifecycle operations are async.

## Installation

```bash
npm install @regibyte/cljam-integrant
```

```typescript
import { library as integrantLib } from '@regibyte/cljam-integrant'

const session = createSession({ ...nodePreset(), libraries: [integrantLib] })
```

## Usage

```clojure
(require '[cljam.integrant.core :as ig])

;; 1. Define the config map
(def config
  {:app/db     {:url "postgresql://localhost/mydb"}
   :app/server {:port 3000 :db (ig/ref :app/db)}})

;; 2. Implement lifecycle multimethods
(defmethod ig/init-key :app/db [_ {:keys [url]}]
  (connect! url))

(defmethod ig/halt-key! :app/db [_ db]
  (disconnect! db))

(defmethod ig/init-key :app/server [_ {:keys [port db]}]
  (start-server! port db))

(defmethod ig/halt-key! :app/server [_ server]
  (stop-server! server))

;; 3. Start and stop
(def *system (atom nil))

(async (reset! *system @(ig/init config)))
(async @(ig/halt! @*system))
```

## Partial start

```clojure
;; Start only :app/db and its declared dependencies
(ig/init config #{:app/db})
```

## Hot reload

```clojure
(async
  @(ig/suspend! @*system)
  ;; ... reload code / new config here ...
  (reset! *system @(ig/resume new-config @*system)))
```

Override `resume-key` to reuse unchanged components:

```clojure
(defmethod ig/resume-key :app/db [key value old-value old-impl]
  (if (= value old-value)
    old-impl           ;; config unchanged — reuse
    @(ig/init-key key value)))
```

## API

### References

| Form | Description |
|---|---|
| `(ig/ref key)` | Dependency on key — resolved to started component during `init` |
| `(ig/refset key)` | Like ref, but collects all matching keys into a set |
| `(ig/ref? x)` | True if x is a ref |

### Lifecycle multimethods

| Multimethod | Signature |
|---|---|
| `init-key` | `(key value) → component` |
| `halt-key!` | `(key component) → nil` |
| `suspend-key!` | `(key component) → nil` (default: calls `halt-key!`) |
| `resume-key` | `(key value old-value old-impl) → component` (default: calls `init-key`) |

### System operations (all return `CljPending`)

| Function | Description |
|---|---|
| `(ig/init config)` | Start all components |
| `(ig/init config keys)` | Start only the given keys |
| `(ig/halt! system)` | Stop all components in reverse order |
| `(ig/suspend! system)` | Suspend for hot reload |
| `(ig/resume config system)` | Restart, reusing unchanged components |
