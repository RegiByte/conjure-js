# Getting Started

## Installation

```bash
# As a library
npm install @regibyte/cljam
# or
bun add @regibyte/cljam
```

```bash
# As a global CLI (Bun required)
bun install -g @regibyte/cljam
```

## Your first session

```typescript
import { createSession, printString, nodePreset } from '@regibyte/cljam'

const session = createSession({ ...nodePreset() })

const result = session.evaluate('(map inc [1 2 3])')
console.log(printString(result)) // => (2 3 4)
```

`createSession` returns a lightweight object — no servers, no daemons. Call `evaluate` or `evaluateAsync` directly.

## CLI

```bash
# Interactive REPL
cljam repl

# Run a file
cljam run my-script.clj

# Start nREPL server for editor connection
cljam nrepl-server
cljam nrepl-server --port 7889 --root-dir .
```

## Connecting Calva (VS Code)

Add to `.vscode/settings.json`:

```json
{
  "calva.replConnectSequences": [
    {
      "name": "cljam nREPL",
      "projectType": "generic",
      "nReplPortFile": [".nrepl-port"]
    }
  ]
}
```

Then: **Calva: Connect to Running REPL Server in Project** → select `cljam nREPL`.

## Source root discovery

cljam reads `cljam.sourceRoots` from `package.json` to resolve `(:require [my.ns])`:

```json
{
  "cljam": {
    "sourceRoots": ["src/clojure"]
  }
}
```

## Using libraries

```json
{
  "cljam": {
    "libraries": ["@regibyte/cljam-schema", "@regibyte/cljam-date"]
  }
}
```

Libraries listed here are auto-loaded when you start a session with `--root-dir .` or use `new_session { root_dir }` via cljam-mcp.

See the [Embedding guide](./embedding) for injecting host APIs and building sandboxes.
