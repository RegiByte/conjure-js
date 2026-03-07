import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as net from 'net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BDecoderStream, BEncoderStream } from './bencode'
import { startNreplServer } from './nrepl'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type NreplMessage = Record<string, unknown>

/** Connect to a running nREPL server and return helpers to send/receive. */
function connectClient(port: number): Promise<{
  send: (msg: NreplMessage) => void
  receive: () => Promise<NreplMessage>
  close: () => void
}> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    const encoder = new BEncoderStream()
    const decoder = new BDecoderStream()

    encoder.pipe(socket)
    socket.pipe(decoder)

    const queue: NreplMessage[] = []
    const waiters: ((msg: NreplMessage) => void)[] = []

    decoder.on('data', (msg: NreplMessage) => {
      const waiter = waiters.shift()
      if (waiter) {
        waiter(msg)
      } else {
        queue.push(msg)
      }
    })

    function receive(): Promise<NreplMessage> {
      return new Promise((res) => {
        const queued = queue.shift()
        if (queued) {
          res(queued)
        } else {
          waiters.push(res)
        }
      })
    }

    socket.on('connect', () => {
      resolve({
        send: (msg) => encoder.write(msg),
        receive,
        close: () => socket.destroy(),
      })
    })

    socket.on('error', reject)
  })
}

/** Collect all messages until one has status containing 'done'. */
async function collectUntilDone(
  receive: () => Promise<NreplMessage>
): Promise<NreplMessage[]> {
  const msgs: NreplMessage[] = []
  while (true) {
    const msg = await receive()
    msgs.push(msg)
    const status = msg['status'] as string[] | undefined
    if (status?.includes('done')) break
  }
  return msgs
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const TEST_PORT = 17888

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    ;(server as any).closeAllConnections?.()
    server.close(() => resolve())
  })
}

describe('nREPL server', () => {
  let server: net.Server

  beforeAll(async () => {
    server = startNreplServer({ port: TEST_PORT })
    // Wait for the server to start listening
    await new Promise<void>((resolve) => server.once('listening', resolve))
  })

  afterAll(async () => {
    await closeServer(server)
  })

  it('responds to eval with a value', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'eval', code: '(+ 1 2)', id: '1' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect(done?.['value']).toBe('3')
    expect(done?.['ns']).toBe('user')

    client.close()
  })

  it('responds to eval *ns* with user namespace', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'eval', code: '*ns*', id: 'ns-1' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect(done?.['ns']).toBe('user')

    client.close()
  })

  it('clone creates a new session', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'clone', id: '2' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect(done?.['new-session']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )

    client.close()
  })

  it('eval within a cloned session is isolated', async () => {
    const client = await connectClient(TEST_PORT)

    // Clone session A
    client.send({ op: 'clone', id: 'c1' })
    const cloneA = await collectUntilDone(client.receive)
    const sessionA = cloneA.find((m) => m['new-session'])?.['new-session'] as string

    // Clone session B
    client.send({ op: 'clone', id: 'c2' })
    const cloneB = await collectUntilDone(client.receive)
    const sessionB = cloneB.find((m) => m['new-session'])?.['new-session'] as string

    // Define x in session A
    client.send({ op: 'eval', code: '(def x 42)', id: 'e1', session: sessionA })
    await collectUntilDone(client.receive)

    // x must not be visible in session B
    client.send({ op: 'eval', code: 'x', id: 'e2', session: sessionB })
    const result = await collectUntilDone(client.receive)
    const done = result.find((m) => (m['status'] as string[])?.includes('done'))

    // Either eval-error (unbound) or no 'value' of 42
    const isError = (done?.['status'] as string[])?.includes('eval-error')
    const value = done?.['value']
    expect(isError || value !== '42').toBe(true)

    client.close()
  })

  it('describe returns supported ops', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'describe', id: '3' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    const ops = done?.['ops'] as Record<string, unknown>
    expect(ops).toBeDefined()
    expect(ops['eval']).toBeDefined()
    expect(ops['clone']).toBeDefined()
    expect(ops['close']).toBeDefined()
    expect(ops['describe']).toBeDefined()
    expect(ops['load-file']).toBeDefined()

    client.close()
  })

  it('println produces out messages before done', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'eval', code: '(println "hello")', id: 'p1' })
    const msgs = await collectUntilDone(client.receive)

    const outMsgs = msgs.filter((m) => m['out'] !== undefined)
    expect(outMsgs.length).toBeGreaterThan(0)
    const combined = outMsgs.map((m) => m['out']).join('')
    expect(combined).toContain('hello')

    client.close()
  })

  it('eval error returns eval-error status', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'eval', code: '(throw (ex-info "boom" {}))', id: 'err1' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect((done?.['status'] as string[])?.includes('eval-error')).toBe(true)
    expect(done?.['ex']).toBeTruthy()

    client.close()
  })

  it('unknown op returns unknown-op status', async () => {
    const client = await connectClient(TEST_PORT)

    client.send({ op: 'frobnicate', id: 'u1' })
    const msgs = await collectUntilDone(client.receive)

    const done = msgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect((done?.['status'] as string[])?.includes('unknown-op')).toBe(true)

    client.close()
  })

  it('close removes the session', async () => {
    const client = await connectClient(TEST_PORT)

    // Clone first
    client.send({ op: 'clone', id: 'cl1' })
    const cloneMsgs = await collectUntilDone(client.receive)
    const sessionId = cloneMsgs.find((m) => m['new-session'])?.['new-session'] as string

    // Close it
    client.send({ op: 'close', session: sessionId })
    const closeMsgs = await collectUntilDone(client.receive)

    const done = closeMsgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect(done?.['session']).toBe(sessionId)

    client.close()
  })

  it('calva handshake sequence succeeds', async () => {
    const client = await connectClient(TEST_PORT)

    // Step 1: session-less eval to query *ns*
    client.send({ op: 'eval', code: '*ns*', id: 'h1' })
    const step1 = await collectUntilDone(client.receive)
    const ns = step1.find((m) => m['ns'])?.['ns']
    expect(ns).toBe('user')

    // Step 2: clone
    client.send({ op: 'clone', id: 'h2' })
    const step2 = await collectUntilDone(client.receive)
    const newSession = step2.find((m) => m['new-session'])?.['new-session'] as string
    expect(newSession).toBeTruthy()

    // Step 3: describe
    client.send({ op: 'describe', id: 'h3', session: newSession, verbose: true })
    const step3 = await collectUntilDone(client.receive)
    const descDone = step3.find((m) => (m['status'] as string[])?.includes('done'))
    expect(descDone?.['ops']).toBeDefined()

    client.close()
  })

  it('load-file with file-path infers source root and resolves requires', async () => {
    const client = await connectClient(TEST_PORT)

    // Clone a fresh session so inferred roots don't leak to other tests
    client.send({ op: 'clone', id: 'lf-clone' })
    const cloneMsgs = await collectUntilDone(client.receive)
    const session = cloneMsgs.find((m) => m['new-session'])?.['new-session'] as string

    // Load app/main.clj which requires app.lib — the file-path lets the
    // server infer the source root so app/lib.clj resolves automatically.
    const fixtureRoot = resolve(__dirname, '__fixtures__/smoke')
    const mainPath = resolve(fixtureRoot, 'app/main.clj')
    const mainSource = readFileSync(mainPath, 'utf8')

    client.send({
      op: 'load-file',
      id: 'lf-1',
      session,
      file: mainSource,
      'file-name': 'app/main.clj',
      'file-path': mainPath,
    })
    const loadMsgs = await collectUntilDone(client.receive)

    const loadDone = loadMsgs.find((m) => (m['status'] as string[])?.includes('done'))
    // Should succeed without eval-error — app.lib resolved via inferred root
    expect((loadDone?.['status'] as string[])?.includes('eval-error')).toBeFalsy()

    // Verify the loaded namespace's function is accessible
    client.send({ op: 'eval', code: '(app.lib/add 10 20)', id: 'lf-2', session })
    const evalMsgs = await collectUntilDone(client.receive)
    const evalDone = evalMsgs.find((m) => (m['status'] as string[])?.includes('done'))
    expect(evalDone?.['value']).toBe('30')

    client.close()
  })
})
