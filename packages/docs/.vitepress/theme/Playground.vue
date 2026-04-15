<template>
  <div class="pg">
    <header class="pg-header">
      <div class="pg-header__left">
        <span class="pg-header__title">cljam REPL</span>
        <span class="pg-header__hint"><kbd>⌘Enter</kbd> eval form &nbsp; <kbd>⇧⌘Enter</kbd> eval all</span>
      </div>
      <div class="pg-header__actions">
        <select
          class="pg-btn pg-sample-select"
          ref="sampleSelectRef"
          @change="handleSampleChange"
        >
          <option v-for="(s, i) in SAMPLES" :key="i" :value="String(i)">{{ s.label }}</option>
        </select>
        <button
          class="pg-btn pg-btn--primary"
          @click="handleRunAll"
          title="Evaluate the entire editor buffer (Shift+⌘Enter)"
        >Run all</button>
        <button
          class="pg-btn pg-btn--danger"
          @click="handleClear"
          title="Clear the output panel"
        >Clear output</button>
      </div>
    </header>
    <div class="pg-body">
      <div class="pg-editor-wrap" ref="editorWrapRef">
        <div v-if="!editorReady" class="pg-loading">Loading editor…</div>
      </div>
      <div class="pg-output" ref="outputRef">
        <div class="pg-output-inner" ref="outputInnerRef"></div>
        <div v-show="isEmpty" class="pg-quickref">
          <div class="pg-quickref__section">
            <div class="pg-quickref__label">Shortcuts</div>
            <div class="pg-quickref__shortcut">
              <kbd>⌘Enter</kbd><span>eval form at cursor</span>
            </div>
            <div class="pg-quickref__shortcut">
              <kbd>⇧⌘Enter</kbd><span>eval entire buffer</span>
            </div>
          </div>
          <div class="pg-quickref__section">
            <div class="pg-quickref__label">Tips</div>
            <ul class="pg-quickref__tips">
              <li>Place cursor inside any <code>(…)</code> <code>[…]</code> <code>{…}</code> and press <kbd>⌘Enter</kbd> to eval just that form</li>
              <li>Place cursor right after a symbol, keyword, or number to eval an atom</li>
              <li><code>def</code> bindings and <code>atom</code> state persist between evals — same session throughout</li>
              <li>Use the sample dropdown to explore collections, HOFs, destructuring, strings, and error handling</li>
            </ul>
          </div>
          <div class="pg-quickref__section">
            <div class="pg-quickref__label">Available via require</div>
            <div class="pg-quickref__packages">
              <code>[clojure.string :as str]</code>
              <code>[clojure.edn :as edn]</code>
              <code>[clojure.math :as math]</code>
              <code>[cljam.schema.core :as s]</code>
              <code>[cljam.date :as date]</code>
              <code>[cljam.integrant :as ig]</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { makeRepl, evalSource } from './repl'
import type { ReplEntry } from './repl'

// Sample raw imports — plain strings, safe at module level (no browser APIs)
import welcomeSrc from './samples/00-welcome.clj?raw'
import collectionsSrc from './samples/01-collections.clj?raw'
import hofSrc from './samples/02-higher-order-functions.clj?raw'
import destructuringSrc from './samples/03-destructuring.clj?raw'
import stringsRegexSrc from './samples/04-strings-and-regex.clj?raw'
import errorHandlingSrc from './samples/05-error-handling.clj?raw'

const SAMPLES = [
  { label: 'Welcome',          content: welcomeSrc },
  { label: 'Collections',      content: collectionsSrc },
  { label: 'Higher-Order Fns', content: hofSrc },
  { label: 'Destructuring',    content: destructuringSrc },
  { label: 'Strings & Regex',  content: stringsRegexSrc },
  { label: 'Error Handling',   content: errorHandlingSrc },
]

// ── Template refs ──────────────────────────────────────────────────────────────

const editorWrapRef = ref<HTMLElement>()
const outputRef     = ref<HTMLElement>()
const outputInnerRef = ref<HTMLElement>()
const sampleSelectRef = ref<HTMLSelectElement>()

// ── UI state ───────────────────────────────────────────────────────────────────

const isEmpty    = ref(true)
const editorReady = ref(false)

// ── Mutable editor state (not reactive — Monaco owns its own model) ────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let editorInstance: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inlineWidget: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clearOnEditDisposable: any = null
let currentSampleIdx = 0

// ── DOM helpers ────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1)   return `${durationMs.toFixed(3)} ms`
  if (durationMs < 10)  return `${durationMs.toFixed(2)} ms`
  if (durationMs < 100) return `${durationMs.toFixed(1)} ms`
  return `${Math.round(durationMs)} ms`
}

function appendEntries(entries: ReplEntry[], outputInner: HTMLElement, source: string): void {
  const entryEl = el('div', 'pg-entry')

  const sourceEl = el('div', 'pg-entry__source')
  sourceEl.textContent = source
  entryEl.appendChild(sourceEl)

  for (const entry of entries) {
    if (entry.kind === 'output') {
      const outEl = el('div', 'pg-entry__output')
      outEl.textContent = entry.text
      entryEl.appendChild(outEl)
    } else if (entry.kind === 'result') {
      const resEl = el('div', 'pg-entry__result')
      resEl.textContent = `→ ${entry.output} `
      const durEl = el('span', 'pg-entry__duration')
      durEl.textContent = `(${formatDuration(entry.durationMs)})`
      resEl.appendChild(durEl)
      entryEl.appendChild(resEl)
    } else if (entry.kind === 'error') {
      const errEl = el('div', 'pg-entry__result pg-entry__result--error')
      errEl.textContent = `✗ ${entry.message} `
      const durEl = el('span', 'pg-entry__duration')
      durEl.textContent = `(${formatDuration(entry.durationMs)})`
      errEl.appendChild(durEl)
      entryEl.appendChild(errEl)
    }
  }

  outputInner.appendChild(entryEl)
}

// ── Monaco init (client-only) ─────────────────────────────────────────────────

onMounted(async () => {
  if (!editorWrapRef.value || !outputInnerRef.value || !outputRef.value) return

  // pageClass frontmatter only applies to VPDoc, not VPPage (layout: page).
  // We manage the full-page class ourselves so our CSS overrides take effect.
  document.documentElement.classList.add('pg-full-page')

  // Must be set BEFORE importing monaco-editor
  ;(window as Window & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker(_moduleId: string, _label: string) {
      return new Worker(
        new URL('./editor.worker.ts', import.meta.url),
        { type: 'module' },
      )
    },
  }

  // Monaco and clojure-tokens both import from 'monaco-editor'.
  // Dynamic import here ensures they never touch the SSR build.
  const [
    monaco,
    { registerClojureLanguage, defineMonacoTheme, THEME_ID },
    { findFormBeforeCursor },
  ] = await Promise.all([
    import('monaco-editor'),
    import('./clojure-tokens'),
    import('./find-form'),
  ])

  registerClojureLanguage(monaco)
  defineMonacoTheme(monaco)

  editorInstance = monaco.editor.create(editorWrapRef.value, {
    value: SAMPLES[0].content,
    language: 'clojure',
    theme: THEME_ID,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
    fontLigatures: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'gutter',
    bracketPairColorization: { enabled: true },
    matchBrackets: 'always',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  })

  editorReady.value = true

  const replState = makeRepl()

  // ── Inline result widget ────────────────────────────────────────────────────

  function showInlineResult(endOffset: number, text: string, isError: boolean): void {
    clearInline()
    const model = editorInstance.getModel()
    if (!model) return
    const endCharPos = model.getPositionAt(Math.max(0, endOffset - 1))
    const line = endCharPos.lineNumber
    const col  = model.getLineMaxColumn(line)

    const domNode = document.createElement('span')
    domNode.className = isError ? 'pg-inline-error' : 'pg-inline-result'
    domNode.textContent = `  ⇒ ${text}`

    const widget = {
      getId:       () => 'pg.inline',
      getDomNode:  () => domNode,
      getPosition: () => ({
        position:   { lineNumber: line, column: col },
        preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
      }),
    }
    inlineWidget = widget
    editorInstance.addContentWidget(widget)
    clearOnEditDisposable = editorInstance.onDidChangeModelContent(() => clearInline())
  }

  function clearInline(): void {
    if (inlineWidget) {
      editorInstance.removeContentWidget(inlineWidget)
      inlineWidget = null
    }
    clearOnEditDisposable?.dispose()
    clearOnEditDisposable = null
  }

  // ── Eval ───────────────────────────────────────────────────────────────────

  async function evalAtCursor(): Promise<void> {
    const source = editorInstance.getValue()
    if (!source.trim()) return

    const model  = editorInstance.getModel()
    const pos    = editorInstance.getPosition()
    const offset = model && pos ? model.getOffsetAt(pos) : source.length

    const form       = findFormBeforeCursor(source, offset)
    const formSource = form ? source.slice(form.start, form.end) : source.trim()
    const formEnd    = form ? form.end : source.trimEnd().length

    const entries = await evalSource(replState, formSource)
    isEmpty.value = false
    appendEntries(entries, outputInnerRef.value!, formSource)
    outputRef.value!.scrollTop = outputRef.value!.scrollHeight

    const hasContentBelow = source.slice(formEnd).trim().length > 0
    const crop = (text: string) => hasContentBelow ? text.split('\n')[0] : text
    const last = entries[entries.length - 1]
    if (last?.kind === 'result') showInlineResult(formEnd, crop(last.output), false)
    else if (last?.kind === 'error') showInlineResult(formEnd, crop(last.message), true)
  }

  async function evalAll(): Promise<void> {
    const source = editorInstance.getValue()
    if (!source.trim()) return
    clearInline()
    const entries = await evalSource(replState, source.trim())
    isEmpty.value = false
    appendEntries(entries, outputInnerRef.value!, source.trim())
    outputRef.value!.scrollTop = outputRef.value!.scrollHeight
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    evalAtCursor()
  })
  editorInstance.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    () => { evalAll() },
  )

  // ── Expose to template-facing handlers ────────────────────────────────────

  handleRunAllFn = evalAll
  handleClearFn = () => {
    outputInnerRef.value!.innerHTML = ''
    isEmpty.value = true
    clearInline()
  }
  handleSampleChangeFn = (idx: number) => {
    const sample = SAMPLES[idx]
    if (!sample) return
    const ok = window.confirm(`Load "${sample.label}"?\n\nYour current edits will be lost.`)
    if (!ok) {
      if (sampleSelectRef.value) sampleSelectRef.value.value = String(currentSampleIdx)
      return
    }
    currentSampleIdx = idx
    editorInstance.setValue(sample.content)
    clearInline()
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('pg-full-page')
  clearOnEditDisposable?.dispose()
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
})

// ── Template-facing handlers ───────────────────────────────────────────────────
// Defined at module scope so they're always accessible from the template.
// Assigned inside onMounted once Monaco is ready.

let handleRunAllFn: (() => Promise<void>) | null = null
let handleClearFn: (() => void) | null = null
let handleSampleChangeFn: ((idx: number) => void) | null = null

function handleRunAll() { handleRunAllFn?.() }
function handleClear()  { handleClearFn?.() }
function handleSampleChange(e: Event) {
  const idx = Number((e.target as HTMLSelectElement).value)
  handleSampleChangeFn?.(idx)
}
</script>

<style>
/* ── Playground container ────────────────────────────────────────────────────
   CSS variables are scoped to .pg so they don't pollute VitePress globals.
   The playground is always dark regardless of VitePress's light/dark mode.
   ─────────────────────────────────────────────────────────────────────────── */

.pg {
  --pg-bg:           #1e1e1e;
  --pg-bg-header:    #181818;
  --pg-border:       #2d2d2d;
  --pg-border-muted: #252526;
  --pg-text:         #d4d4d4;
  --pg-text-dim:     #a6a6a6;
  --pg-text-subtle:  #808080;
  --pg-accent:       #569cd6;
  --pg-green:        #89d185;
  --pg-red:          #f14c4c;
  --pg-yellow:       #d7ba7d;

  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--vp-nav-height, 64px));
  border: 1px solid var(--pg-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--pg-bg);
  color: var(--pg-text);
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  box-sizing: border-box;
}

.pg *, .pg *::before, .pg *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Header ─────────────────────────────────────────────────────────────── */

.pg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 52px;
  background: var(--pg-bg-header);
  border-bottom: 1px solid var(--pg-border);
  flex-shrink: 0;
}

.pg-header__left    { display: flex; align-items: center; gap: 1rem; }
.pg-header__title   { color: var(--pg-accent); font-size: 0.9rem; font-weight: 600; letter-spacing: 0.02em; }
.pg-header__hint    { color: var(--pg-text-subtle); font-size: 0.78rem; }
.pg-header__actions { display: flex; gap: 0.6rem; align-items: center; }

/* ── Body ───────────────────────────────────────────────────────────────── */

.pg-body       { display: flex; flex: 1; overflow: hidden; }
.pg-editor-wrap { flex: 3; min-width: 0; position: relative; }
.pg-output {
  flex: 2;
  min-width: 0;
  overflow-y: auto;
  border-left: 1px solid var(--pg-border);
  background: var(--pg-bg);
}
.pg-output-inner { padding: 1.25rem; }

/* ── Loading state ──────────────────────────────────────────────────────── */

.pg-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pg-text-subtle);
  font-size: 0.85rem;
  background: var(--pg-bg);
}

/* ── Empty state ────────────────────────────────────────────────────────── */

.pg-empty {
  color: var(--pg-text-subtle);
  font-size: 0.82rem;
  text-align: center;
  padding-top: 3rem;
  line-height: 1.7;
}

/* ── Output entries ─────────────────────────────────────────────────────── */

.pg-entry            { margin-bottom: 1.5rem; }

.pg-entry__source {
  font-size: 0.78rem;
  color: var(--pg-text-subtle);
  margin-bottom: 0.35rem;
  padding: 0 0.25rem;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}

.pg-entry__output {
  font-size: 0.85rem;
  color: var(--pg-yellow);
  padding: 0.4rem 0.75rem;
  border-left: 2px solid color-mix(in srgb, var(--pg-yellow) 30%, transparent);
  margin-bottom: 0.25rem;
  white-space: pre-wrap;
}

.pg-entry__result {
  font-size: 0.88rem;
  color: var(--pg-green);
  padding: 0.5rem 0.75rem;
  border-left: 2px solid var(--pg-green);
  background: color-mix(in srgb, var(--pg-green) 4%, transparent);
  white-space: pre-wrap;
  word-break: break-all;
}

.pg-entry__result--error {
  color: var(--pg-red);
  border-left-color: var(--pg-red);
  background: color-mix(in srgb, var(--pg-red) 4%, transparent);
}

.pg-entry__duration {
  color: var(--pg-text-subtle);
  font-size: 0.92em;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

.pg-btn {
  background: var(--pg-bg-header);
  color: var(--pg-text-dim);
  border: 1px solid var(--pg-border);
  padding: 0.3rem 0.85rem;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.pg-btn:hover { background: #1c2128; border-color: #8b949e; color: var(--pg-text); }

.pg-btn--primary {
  color: var(--pg-accent);
  border-color: color-mix(in srgb, var(--pg-accent) 30%, transparent);
  background: color-mix(in srgb, var(--pg-accent) 8%, transparent);
}
.pg-btn--primary:hover {
  background: color-mix(in srgb, var(--pg-accent) 15%, transparent);
  border-color: var(--pg-accent);
}
.pg-btn--danger:hover { color: var(--pg-red); border-color: color-mix(in srgb, var(--pg-red) 40%, transparent); }

.pg-sample-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 1.75rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23808080'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 8px 5px;
  cursor: pointer;
}

.pg .pg-header kbd {
  background: var(--pg-bg-header);
  border: 1px solid var(--pg-border);
  border-radius: 4px;
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  color: var(--pg-text-dim);
  font-family: inherit;
}

/* ── Inline eval result widget ──────────────────────────────────────────── */

.pg-inline-result,
.pg-inline-error {
  pointer-events: none;
  white-space: pre;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 14px;
  font-style: italic;
  opacity: 0.80;
  padding-left: 0.5ch;
}

.pg-inline-result { color: #7ee787; }
.pg-inline-error  { color: #f85149; }

/* ── Quick Reference (empty state) ─────────────────────────────────────── */

.pg-quickref {
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pg-quickref__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pg-quickref__label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pg-text-subtle);
  margin-bottom: 0.25rem;
}

.pg-quickref__shortcut {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.82rem;
}

.pg-quickref__shortcut kbd {
  background: var(--pg-bg-header);
  border: 1px solid var(--pg-border);
  border-radius: 4px;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  color: var(--pg-accent);
  font-family: inherit;
  white-space: nowrap;
}

.pg-quickref__shortcut span { color: var(--pg-text-dim); }

.pg-quickref__tips {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.pg-quickref__tips li {
  font-size: 0.8rem;
  color: var(--pg-text-dim);
  line-height: 1.5;
  padding-left: 0.75rem;
  position: relative;
}

.pg-quickref__tips li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--pg-text-subtle);
}

.pg-quickref__tips code {
  background: color-mix(in srgb, var(--pg-accent) 10%, transparent);
  color: var(--pg-accent);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.78rem;
  font-family: inherit;
}

.pg-quickref__tips kbd {
  background: var(--pg-bg-header);
  border: 1px solid var(--pg-border);
  border-radius: 3px;
  padding: 0.05rem 0.35rem;
  font-size: 0.73rem;
  color: var(--pg-text-dim);
  font-family: inherit;
}

.pg-quickref__packages {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.pg-quickref__packages code {
  font-size: 0.78rem;
  color: var(--pg-yellow);
  font-family: inherit;
  padding: 0.15rem 0;
}

/* ── Full-page mode (playground.md uses pageClass: pg-full-page) ────────── */

/* VitePress applies pageClass to <html>, not <body> */
html.pg-full-page body {
  overflow: hidden; /* playground owns all scrolling */
}

html.pg-full-page .VPPage {
  padding: 0;
}

html.pg-full-page .VPFooter {
  display: none;
}

html.pg-full-page .pg {
  height: calc(100vh - var(--vp-nav-height, 64px));
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  border-top: 1px solid var(--pg-border);
}
</style>
