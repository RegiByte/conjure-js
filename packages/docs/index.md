---
layout: home

hero:
  name: cljam
  text: Clojure for JavaScript
  tagline: A Clojure interpreter that embeds in any JS/TS project. Run as a CLI, connect from Calva, or give LLMs a persistent REPL via MCP.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Try it in the browser
      link: /playground
    - theme: alt
      text: View on GitHub
      link: https://github.com/RegiByte/cljam

features:
  - icon: 🧩
    title: Embeddable
    details: createSession() gives you a sandboxed Clojure runtime in any JS/TS project. Inject host capabilities, load libraries, evaluate strings.

  - icon: 🔌
    title: nREPL compatible
    details: Full TCP nREPL server. Calva, CIDER, and Cursive connect out of the box. Pair-program with an LLM in the same live runtime.

  - icon: 🤖
    title: LLM-native
    details: cljam-mcp is an MCP server giving Claude and other LLMs a persistent, stateful Clojure environment as tool calls.

  - icon: 📦
    title: Library ecosystem
    details: cljam-schema (malli-inspired validation), cljam-date, cljam-integrant — all installable from npm. Build your own libraries with cljam gen-lib-source.
---
