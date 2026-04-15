# cljam-mcp

[![npm](https://img.shields.io/npm/v/%40regibyte%2Fcljam-mcp)](https://www.npmjs.com/package/@regibyte/cljam-mcp)

An MCP server that gives LLMs a persistent, interactive Clojure REPL. Sessions survive across tool calls. Pair-program with a human developer in Calva — sharing the same live runtime.

See the full [MCP Integration guide](/guide/mcp) for setup instructions and workflow examples.

## Quick setup (Claude Code)

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

## Tools at a glance

**Mode 1 — Built-in sessions:**
`new_session` · `eval` · `load_file` · `list_sessions` · `delete_session` · `handbook`

**Mode 2 — nREPL bridge:**
`connect_nrepl` · `nrepl_eval` · `nrepl_sessions` · `nrepl_new_session` · `nrepl_server_sessions` · `nrepl_close`
