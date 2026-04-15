# LLM Integration with cljam-mcp

`@regibyte/cljam-mcp` is an [MCP](https://modelcontextprotocol.io/) server that gives LLMs a persistent, stateful Clojure REPL as tool calls. Sessions survive across turns — define a function, call it ten turns later.

## Setup in Claude Code

Add to your project's `.claude.json`:

```json
{
  "mcpServers": {
    "cljam": {
      "command": "npx",
      "args": ["@regibyte/cljam-mcp"]
    }
  }
}
```

Claude Code restarts the server automatically on crash.

## Mode 1: Built-in sessions

The LLM creates and manages Clojure sessions directly:

```
new_session {}
→ { session_id: "abc123", preset: "sandbox" }

eval { session_id: "abc123", code: "(defn greet [n] (str \"hello \" n))" }
eval { session_id: "abc123", code: "(greet \"world\")" }
→ { result: "\"hello world\"" }
```

Load project files with `root_dir`:

```
new_session { root_dir: "/path/to/project" }
load_file { session_id: "...", path: "src/my/lib.clj" }
eval { session_id: "...", code: "(my.lib/main)" }
```

## Mode 2: nREPL bridge (pair programming)

Connect to the same nREPL server the human developer is using in Calva. Both parties share the same live runtime — atoms, namespaces, definitions:

```bash
# Human starts the nREPL server
cljam nrepl-server --root-dir . --port 7888

# Human connects Calva → Calva: Connect to Running REPL Server in Project
```

```
# LLM connects via MCP
connect_nrepl { port: 7888 }
→ {
    connection_id: "conn-xyz",
    session_id: "my-fresh-session-uuid",
    other_sessions: [
      { id: "calva-session-uuid", ns: "my-app.dev" }
    ]
  }

# LLM evals into Calva's session — true shared state
nrepl_eval {
  connection_id: "conn-xyz",
  session_id: "calva-session-uuid",
  code: "(def answer 42)"
}
# Human can now call (answer) from Calva and get 42
```

`other_sessions` in the connect response identifies every pre-existing session. Pick the one with the active namespace — that's Calva.

## Introspection with `describe`

`describe` is a Clojure function, called inside `eval`:

```
eval { session_id: "...", code: "(describe #'clojure.core/map)" }
→ { :name map :ns clojure.core :doc "..." :arglists (...) }

eval { session_id: "...", code: "(describe (find-ns 'clojure.core))" }
→ { :name clojure.core :vars [...] }
```

## Quick reference with `handbook`

```
handbook {}
→ list of all topic keys

handbook { topic: "sort" }
→ dense reference entry with examples
```

Handbook topics include `jvm-gaps`, `types`, `records`, `protocols`, `schema-api`, `describe`, `sessions`, `pair-programming`, and more.

## All tools

### Mode 1

| Tool | Description |
|---|---|
| `new_session` | Create a session (`sandbox` or `node` preset, optional `root_dir`) |
| `eval` | Evaluate Clojure — returns `result`, `ns`, `stdout`, `error` |
| `load_file` | Load a `.clj` file into the session |
| `list_sessions` | List active sessions |
| `delete_session` | Delete a session |
| `handbook` | Look up a quick-reference topic |

### Mode 2

| Tool | Description |
|---|---|
| `connect_nrepl` | Connect to nREPL server — returns `connection_id`, `session_id`, `other_sessions` |
| `nrepl_eval` | Eval in an nREPL session |
| `nrepl_sessions` | List sessions on this connection |
| `nrepl_new_session` | Clone a fresh session |
| `nrepl_server_sessions` | List ALL sessions server-wide (all connected clients) |
| `nrepl_close` | Close the connection |
