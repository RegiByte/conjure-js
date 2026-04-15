import { tokenize } from '@regibyte/cljam'

export type FormRange = {
  start: number
  end: number
}

const OPEN = new Set(['LParen', 'LBracket', 'LBrace', 'AnonFnStart', 'SetStart'])
const CLOSE = new Set(['RParen', 'RBracket', 'RBrace'])
const PREFIX = new Set(['Quote', 'Quasiquote', 'Unquote', 'UnquoteSplicing'])
const SKIP = new Set(['Whitespace', 'Comment'])

export function findFormBeforeCursor(
  source: string,
  cursorOffset: number,
): FormRange | null {
  let tokens
  try {
    tokens = tokenize(source)
  } catch {
    try {
      tokens = tokenize(source.slice(0, cursorOffset))
    } catch {
      return null
    }
  }

  const relevant = tokens.filter(
    (t) => !SKIP.has(t.kind) && t.end.offset <= cursorOffset,
  )

  if (relevant.length === 0) return null

  const lastIdx = relevant.length - 1
  const last = relevant[lastIdx]

  let range: FormRange

  if (CLOSE.has(last.kind)) {
    const openIdx = findMatchingOpen(relevant, lastIdx)
    if (openIdx === -1) return null
    range = {
      start: relevant[openIdx].start.offset,
      end: last.end.offset,
    }
    return extendWithPrefix(relevant, openIdx, range)
  }

  if (OPEN.has(last.kind)) {
    return { start: last.start.offset, end: last.end.offset }
  }

  if (!PREFIX.has(last.kind)) {
    range = { start: last.start.offset, end: last.end.offset }
    return extendWithPrefix(relevant, lastIdx, range)
  }

  return null
}

type Token = ReturnType<typeof tokenize>[number]

function findMatchingOpen(relevant: Token[], closeIdx: number): number {
  const closeKind = relevant[closeIdx].kind
  const openKind =
    closeKind === 'RParen'
      ? 'LParen'
      : closeKind === 'RBracket'
        ? 'LBracket'
        : 'LBrace'

  let depth = 1
  for (let i = closeIdx - 1; i >= 0; i--) {
    const k = relevant[i].kind
    if (k === closeKind) depth++
    else if (
      k === openKind ||
      (openKind === 'LParen' && k === 'AnonFnStart') ||
      (openKind === 'LBrace' && k === 'SetStart')
    ) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function extendWithPrefix(
  relevant: Token[],
  formStartIdx: number,
  range: FormRange,
): FormRange {
  if (formStartIdx > 0) {
    const prev = relevant[formStartIdx - 1]
    if (PREFIX.has(prev.kind)) {
      return { start: prev.start.offset, end: range.end }
    }
  }
  return range
}
