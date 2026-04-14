import {
  createSession,
  nodePreset,
  sandboxPreset,
  type Session,
} from '@regibyte/cljam'
import { readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Preset = 'sandbox' | 'node'

export type SessionRecord = {
  id: string
  session: Session
  preset: Preset
  rootDir?: string
  createdAt: Date
  /** Mutable buffer — the session's output callback appends here. Reset before each eval. */
  outputBuffer: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReadFile(rootDir?: string) {
  if (!rootDir) return undefined
  return (filePath: string) => {
    const abs = isAbsolute(filePath) ? filePath : resolve(rootDir, filePath)
    return readFileSync(abs, 'utf-8')
  }
}

function makeSessionOptions(preset: Preset, rootDir: string | undefined, outputBuffer: string[]) {
  const base = preset === 'node' ? nodePreset() : sandboxPreset()
  return {
    ...base,
    // Override the preset's output/stderr to capture into our buffer
    output: (text: string) => outputBuffer.push(text),
    stderr: (text: string) => outputBuffer.push(`[stderr] ${text}`),
    ...(rootDir
      ? {
          readFile: makeReadFile(rootDir),
          sourceRoots: [rootDir],
        }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager {
  private sessions = new Map<string, SessionRecord>()

  create(preset: Preset = 'sandbox', rootDir?: string): SessionRecord {
    const id = randomUUID()
    const outputBuffer: string[] = []
    const session = createSession(makeSessionOptions(preset, rootDir, outputBuffer))

    const record: SessionRecord = {
      id,
      session,
      preset,
      rootDir,
      createdAt: new Date(),
      outputBuffer,
    }
    this.sessions.set(id, record)
    return record
  }

  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id)
  }

  delete(id: string): boolean {
    return this.sessions.delete(id)
  }

  list(): SessionRecord[] {
    return [...this.sessions.values()]
  }
}
