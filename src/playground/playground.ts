import * as monaco from 'monaco-editor'
import { makeRepl, evalSource } from '../repl/repl'
import type { ReplEntry } from '../repl/repl'
import { THEME_ID, registerClojureLanguage, defineMonacoTheme } from './clojure-tokens'
import { findFormBeforeCursor } from './find-form'

// ── Monaco worker setup ──────────────────────────────────────────────────────
// Vite only resolves the worker-bundling pattern for relative paths.
// We use a thin wrapper (./editor.worker.ts) so Vite can bundle it correctly.
// Workers are created lazily on editor.create(); setting MonacoEnvironment here
// is sufficient because monaco reads it when it first needs to spawn a worker.
window.MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string) {
    return new Worker(
      new URL('./editor.worker.ts', import.meta.url),
      { type: 'module' },
    )
  },
}

// ── Sample files ─────────────────────────────────────────────────────────────
// ?raw imports bypass the vite-plugin-clj transform (both resolveId and load
// gate on !id.includes('?')) and return the file contents as plain strings.

import welcomeSrc from './samples/00-welcome.clj?raw'
import collectionsSrc from './samples/01-collections.clj?raw'
import hofSrc from './samples/02-higher-order-functions.clj?raw'
import destructuringSrc from './samples/03-destructuring.clj?raw'
import stringsRegexSrc from './samples/04-strings-and-regex.clj?raw'
import errorHandlingSrc from './samples/05-error-handling.clj?raw'

const SAMPLES = [
  { label: 'Welcome',           content: welcomeSrc },
  { label: 'Collections',       content: collectionsSrc },
  { label: 'Higher-Order Fns',  content: hofSrc },
  { label: 'Destructuring',     content: destructuringSrc },
  { label: 'Strings & Regex',   content: stringsRegexSrc },
  { label: 'Error Handling',    content: errorHandlingSrc },
]

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

// ── Output rendering ──────────────────────────────────────────────────────────

function appendEntries(
  entries: ReplEntry[],
  outputInner: HTMLElement,
  source: string,
): void {
  const entryEl = el('div', 'pg-entry')

  // Source header — dim echo of what was evaluated
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
      resEl.appendChild(createDurationEl(entry.durationMs))
      entryEl.appendChild(resEl)
    } else if (entry.kind === 'error') {
      const errEl = el('div', 'pg-entry__result pg-entry__result--error')
      errEl.textContent = `✗ ${entry.message} `
      errEl.appendChild(createDurationEl(entry.durationMs))
      entryEl.appendChild(errEl)
    }
  }

  outputInner.appendChild(entryEl)
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1) return `${durationMs.toFixed(3)} ms`
  if (durationMs < 10) return `${durationMs.toFixed(2)} ms`
  if (durationMs < 100) return `${durationMs.toFixed(1)} ms`
  return `${Math.round(durationMs)} ms`
}

function createDurationEl(durationMs: number): HTMLSpanElement {
  const durationEl = el('span', 'pg-entry__duration')
  durationEl.textContent = `(${formatDuration(durationMs)})`
  return durationEl
}

// ── Playground bootstrap ──────────────────────────────────────────────────────

function createPlayground(appEl: HTMLElement): void {
  const state = makeRepl()

  // Track which sample is currently loaded so we can revert the select on cancel
  let currentSampleIdx = 0

  // ── DOM skeleton ───────────────────────────────────────────────────────────

  const pgEl = el('div', 'pg')

  // Header
  const headerEl = el('header', 'pg-header')

  const leftEl = el('div', 'pg-header__left')
  const titleEl = el('span', 'pg-header__title')
  titleEl.textContent = 'Regibyte Clojure Playground'
  const hintEl = el('span', 'pg-header__hint')
  hintEl.innerHTML = '<kbd>⌘Enter</kbd> eval form'
  leftEl.appendChild(titleEl)
  leftEl.appendChild(hintEl)

  const actionsEl = el('div', 'pg-header__actions')

  // Sample selector
  const sampleSelect = el('select', 'pg-btn pg-sample-select')
  for (const [i, s] of SAMPLES.entries()) {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = s.label
    sampleSelect.appendChild(opt)
  }

  const runBtn = el('button', 'pg-btn pg-btn--primary')
  runBtn.textContent = 'Run all'
  runBtn.title = 'Evaluate the entire editor buffer (Shift+⌘Enter)'

  const clearBtn = el('button', 'pg-btn pg-btn--danger')
  clearBtn.textContent = 'Clear output'
  clearBtn.title = 'Clear the output panel'

  actionsEl.appendChild(sampleSelect)
  actionsEl.appendChild(runBtn)
  actionsEl.appendChild(clearBtn)
  headerEl.appendChild(leftEl)
  headerEl.appendChild(actionsEl)

  // Body
  const bodyEl = el('div', 'pg-body')
  const editorWrapEl = el('div', 'pg-editor-wrap')
  const outputEl = el('div', 'pg-output')
  const outputInnerEl = el('div', 'pg-output-inner')

  const emptyEl = el('div', 'pg-empty')
  emptyEl.innerHTML =
    'Place cursor inside a form and press <kbd>⌘Enter</kbd><br>Results appear here'

  outputEl.appendChild(outputInnerEl)
  outputEl.appendChild(emptyEl)
  bodyEl.appendChild(editorWrapEl)
  bodyEl.appendChild(outputEl)
  pgEl.appendChild(headerEl)
  pgEl.appendChild(bodyEl)
  appEl.appendChild(pgEl)

  // ── Monaco setup ───────────────────────────────────────────────────────────

  registerClojureLanguage(monaco)
  defineMonacoTheme(monaco)

  const editor = monaco.editor.create(editorWrapEl, {
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
    // Clojure uses () [] {} — turn on bracket matching
    matchBrackets: 'always',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  })

  // ── Inline result widget ──────────────────────────────────────────────────
  // Monaco's `after` InjectedText relies on DOM view-lines being rendered in the
  // viewport; content widgets live in a separate always-present DOM layer and are
  // positioned absolutely by Monaco — they work regardless of scroll state.

  let inlineWidget: monaco.editor.IContentWidget | null = null
  let clearOnEdit: monaco.IDisposable | null = null

  function showInlineResult(
    endOffset: number,
    text: string,
    isError: boolean,
  ): void {
    clearInlineResult()

    const model = editor.getModel()
    if (!model) return

    // Resolve the last line of the evaluated form.
    const endCharPos = model.getPositionAt(Math.max(0, endOffset - 1))
    const line = endCharPos.lineNumber
    const col = model.getLineMaxColumn(line)

    const domNode = document.createElement('span')
    domNode.className = isError ? 'pg-inline-error' : 'pg-inline-result'
    domNode.textContent = `  ⇒ ${text}`

    const widget: monaco.editor.IContentWidget = {
      getId: () => 'pg.inline',
      getDomNode: () => domNode,
      getPosition: () => ({
        position: { lineNumber: line, column: col },
        preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
      }),
    }

    inlineWidget = widget
    editor.addContentWidget(widget)

    clearOnEdit = editor.onDidChangeModelContent(() => clearInlineResult())
  }

  function clearInlineResult(): void {
    if (inlineWidget) {
      editor.removeContentWidget(inlineWidget)
      inlineWidget = null
    }
    clearOnEdit?.dispose()
    clearOnEdit = null
  }

  // ── Sample selector logic ──────────────────────────────────────────────────

  sampleSelect.addEventListener('change', () => {
    const idx = Number(sampleSelect.value)
    const sample = SAMPLES[idx]
    if (!sample) return

    const ok = window.confirm(
      `Load "${sample.label}"?\n\nYour current edits will be lost.`,
    )
    if (!ok) {
      // Revert the select to whichever sample is currently in the editor
      sampleSelect.value = String(currentSampleIdx)
      return
    }

    currentSampleIdx = idx
    editor.setValue(sample.content)
    clearInlineResult()
  })

  // ── Eval logic ─────────────────────────────────────────────────────────────

  /**
   * Calva-style eval: find the innermost complete form whose end is closest to
   * (and ≤) the cursor, evaluate it in the persistent session, show the result
   * as an inline ghost-text decorator, and append it to the output panel.
   *
   * Falls back to evaluating the whole buffer if nothing is found before the
   * cursor (e.g. cursor is at the very start of the file).
   */
  function evalAtCursor(): void {
    const source = editor.getValue()
    if (!source.trim()) return

    const model = editor.getModel()
    const pos = editor.getPosition()
    const offset = model && pos ? model.getOffsetAt(pos) : source.length

    const form = findFormBeforeCursor(source, offset)
    const formSource = form
      ? source.slice(form.start, form.end)
      : source.trim()
    const formEnd = form ? form.end : source.trimEnd().length

    const entries = evalSource(state, formSource)
    emptyEl.style.display = 'none'
    appendEntries(entries, outputInnerEl, formSource)
    outputEl.scrollTop = outputEl.scrollHeight

    // Show inline decorator for the result (or error) of the last entry.
    // When there is more code below the evaluated form, crop the annotation to
    // its first line so it doesn't overlap the following source text.
    const hasContentBelow = source.slice(formEnd).trim().length > 0
    const cropIfNeeded = (text: string) =>
      hasContentBelow ? text.split('\n')[0] : text

    const last = entries[entries.length - 1]
    if (last?.kind === 'result') {
      showInlineResult(formEnd, cropIfNeeded(last.output), false)
    } else if (last?.kind === 'error') {
      showInlineResult(formEnd, cropIfNeeded(last.message), true)
    }
  }

  /** Evaluate the entire buffer — useful when you want to re-run everything. */
  function evalAll(): void {
    const source = editor.getValue()
    if (!source.trim()) return

    clearInlineResult()
    const entries = evalSource(state, source.trim())
    emptyEl.style.display = 'none'
    appendEntries(entries, outputInnerEl, source.trim())
    outputEl.scrollTop = outputEl.scrollHeight
  }

  // ⌘Enter → eval form at cursor
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    evalAtCursor()
  })

  // Shift+⌘Enter → eval whole buffer
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    () => {
      evalAll()
    },
  )

  runBtn.addEventListener('click', () => evalAll())

  clearBtn.addEventListener('click', () => {
    outputInnerEl.innerHTML = ''
    emptyEl.style.display = ''
    clearInlineResult()
  })
}

createPlayground(document.getElementById('app')!)
