import * as net from 'net'
import { readFileSync } from 'node:fs'
import { BDecoderStream, BEncoderStream } from './bencode'
import {
  createSession,
  createSessionFromSnapshot,
  printString,
  snapshotSession,
  type Session,
  type SessionSnapshot,
} from '../core'
import { inferSourceRoot } from './nrepl-utils'

const CONJURE_VERSION = '0.1.0'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NreplMessage = Record<string, unknown>

type ManagedSession = {
  id: string
  session: Session
  /** Mutable: updated to the current eval message id before each eval call */
  currentMsgId: string
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function makeSessionId(): string {
  return crypto.randomUUID()
}

function createManagedSession(
  id: string,
  snapshot: SessionSnapshot,
  encoder: BEncoderStream
): ManagedSession {
  let currentMsgId = ''

  const session = createSessionFromSnapshot(snapshot, {
    output: (text) => {
      send(encoder, { id: currentMsgId, session: id, out: text })
    },
    readFile: (filePath) => readFileSync(filePath, 'utf8'),
  })

  return {
    id,
    session,
    get currentMsgId() {
      return currentMsgId
    },
    set currentMsgId(v) {
      currentMsgId = v
    },
  }
}

// ---------------------------------------------------------------------------
// Protocol helpers
// ---------------------------------------------------------------------------

function send(encoder: BEncoderStream, msg: NreplMessage) {
  encoder.write(msg)
}

function done(
  encoder: BEncoderStream,
  id: string,
  sessionId: string | undefined,
  extra: NreplMessage = {}
) {
  // If the caller already sets status (e.g. ['eval-error', 'done']), preserve it.
  send(encoder, {
    id,
    ...(sessionId ? { session: sessionId } : {}),
    status: ['done'],
    ...extra,
  })
}

// ---------------------------------------------------------------------------
// Op handlers
// ---------------------------------------------------------------------------

function handleClone(
  msg: NreplMessage,
  sessions: Map<string, ManagedSession>,
  snapshot: SessionSnapshot,
  encoder: BEncoderStream
) {
  const id = (msg['id'] as string) ?? ''
  const newId = makeSessionId()
  const managed = createManagedSession(newId, snapshot, encoder)
  sessions.set(newId, managed)
  done(encoder, id, undefined, { 'new-session': newId })
}

function handleDescribe(msg: NreplMessage, encoder: BEncoderStream) {
  const id = (msg['id'] as string) ?? ''
  const sessionId = msg['session'] as string | undefined
  done(encoder, id, sessionId, {
    ops: {
      eval: {},
      clone: {},
      close: {},
      describe: {},
      'load-file': {},
    },
    versions: {
      conjure: { 'version-string': CONJURE_VERSION },
    },
  })
}

function handleEval(
  msg: NreplMessage,
  managed: ManagedSession,
  encoder: BEncoderStream
) {
  const id = (msg['id'] as string) ?? ''
  const code = (msg['code'] as string) ?? ''

  managed.currentMsgId = id

  try {
    const result = managed.session.evaluate(code)
    done(encoder, id, managed.id, {
      value: printString(result),
      ns: managed.session.currentNs,
    })
  } catch (error) {
    done(encoder, id, managed.id, {
      ex: error instanceof Error ? error.message : String(error),
      ns: managed.session.currentNs,
      status: ['eval-error', 'done'],
    })
  }
}

function handleLoadFile(
  msg: NreplMessage,
  managed: ManagedSession,
  encoder: BEncoderStream
) {
  const id = (msg['id'] as string) ?? ''
  const source = (msg['file'] as string) ?? ''
  const fileName = (msg['file-name'] as string) ?? ''
  const filePath = (msg['file-path'] as string) ?? ''

  managed.currentMsgId = id

  try {
    // Dynamically infer source root from the file path + ns declaration.
    // This is the zero-config path: Calva sends the absolute path, and we
    // derive the root so sibling namespaces resolve via require.
    if (filePath) {
      const inferred = inferSourceRoot(filePath, source)
      if (inferred) {
        managed.session.addSourceRoot(inferred)
      }
    }

    const nsHint = fileName.replace(/\.clj$/, '').replace(/\//g, '.') || undefined
    managed.session.loadFile(source, nsHint)

    done(encoder, id, managed.id, {
      value: 'nil',
      ns: managed.session.currentNs,
    })
  } catch (error) {
    done(encoder, id, managed.id, {
      ex: error instanceof Error ? error.message : String(error),
      ns: managed.session.currentNs,
      status: ['eval-error', 'done'],
    })
  }
}

function handleClose(
  msg: NreplMessage,
  sessions: Map<string, ManagedSession>,
  encoder: BEncoderStream
) {
  const sessionId = (msg['session'] as string) ?? ''
  sessions.delete(sessionId)
  send(encoder, { session: sessionId, status: ['done'] })
}

function handleUnknown(msg: NreplMessage, encoder: BEncoderStream) {
  const id = (msg['id'] as string) ?? ''
  send(encoder, { id, status: ['unknown-op', 'done'] })
}

// ---------------------------------------------------------------------------
// Per-connection dispatcher
// ---------------------------------------------------------------------------

function handleMessage(
  msg: NreplMessage,
  sessions: Map<string, ManagedSession>,
  snapshot: SessionSnapshot,
  encoder: BEncoderStream,
  defaultSession: ManagedSession
) {
  const op = msg['op'] as string
  const sessionId = msg['session'] as string | undefined
  const managed = sessionId ? sessions.get(sessionId) ?? defaultSession : defaultSession

  switch (op) {
    case 'clone':
      handleClone(msg, sessions, snapshot, encoder)
      break
    case 'describe':
      handleDescribe(msg, encoder)
      break
    case 'eval':
      handleEval(msg, managed, encoder)
      break
    case 'load-file':
      handleLoadFile(msg, managed, encoder)
      break
    case 'close':
      handleClose(msg, sessions, encoder)
      break
    default:
      handleUnknown(msg, encoder)
  }
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

export type NreplServerOptions = {
  port?: number
  host?: string
  sourceRoots?: string[]
}

export function startNreplServer(options: NreplServerOptions = {}): net.Server {
  const port = options.port ?? 7888
  const host = options.host ?? '127.0.0.1'

  // Build a warm snapshot once — all clones skip the core bootstrap.
  // Source roots from config discovery are baked in so every cloned session inherits them.
  const warmSession = createSession({
    sourceRoots: options.sourceRoots,
    readFile: (filePath) => readFileSync(filePath, 'utf8'),
  })
  const snapshot = snapshotSession(warmSession)

  const server = net.createServer((socket) => {
    const encoder = new BEncoderStream()
    const decoder = new BDecoderStream()

    encoder.pipe(socket)
    socket.pipe(decoder)

    const sessions = new Map<string, ManagedSession>()

    // A default session for session-less messages (e.g. Calva's initial eval)
    const defaultId = makeSessionId()
    const defaultSession = createManagedSession(defaultId, snapshot, encoder)
    sessions.set(defaultId, defaultSession)

    decoder.on('data', (msg: NreplMessage) => {
      handleMessage(msg, sessions, snapshot, encoder, defaultSession)
    })

    socket.on('error', () => {
      // Connection dropped — nothing to clean up beyond GC
    })

    socket.on('close', () => {
      sessions.clear()
    })
  })

  server.listen(port, host, () => {
    process.stdout.write(`nREPL server started on port ${port}\n`)
  })

  return server
}
