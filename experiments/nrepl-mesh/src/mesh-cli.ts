/**
 * mesh-cli — send a one-off eval to a mesh node and stream the output.
 *
 * Usage:
 *   bun src/mesh-cli.ts list
 *   bun src/mesh-cli.ts <target> <form>
 *   bun src/mesh-cli.ts node1 '(println "hello from node1")'
 *   bun src/mesh-cli.ts node1 '(+ 1 2 3)'
 *
 * Env:
 *   REDIS_URL   — broker URL (default: redis://localhost:6379)
 *   TIMEOUT_MS  — eval timeout in ms (default: 10000)
 *
 * Exits 0 on success, 1 on error / timeout.
 */

import { createRedisBroker } from './brokers/redis.js'
import type { EvalRequest } from './protocol.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 10_000)

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage:')
  console.log('  bun src/mesh-cli.ts list')
  console.log('  bun src/mesh-cli.ts <target> <form>')
  process.exit(0)
}

const broker = createRedisBroker({ url: REDIS_URL })

if (args[0] === 'list') {
  const nodes = await broker.discover()
  if (nodes.length === 0) {
    console.log('(no live nodes)')
  } else {
    for (const n of nodes) {
      const age = Math.round((Date.now() - n.lastSeen) / 1000)
      const caps = n.capabilities.length > 0 ? `  [${n.capabilities.join(', ')}]` : ''
      console.log(`  ${n.id}${caps}  (last seen ${age}s ago)`)
    }
  }
  await broker.close()
  process.exit(0)
}

// Eval: <target> <form>  (form may be multiple args, joined with space)
const [targetId, ...formParts] = args
const source = formParts.join(' ')

if (!targetId || !source) {
  console.error('Error: expected <target> <form>')
  console.error('  bun src/mesh-cli.ts node1 \'(+ 1 2 3)\'')
  process.exit(1)
}

const nodes = await broker.discover()
if (!nodes.some((n) => n.id === targetId)) {
  const known = nodes.map((n) => n.id).join(', ') || '(none)'
  console.error(`Error: node "${targetId}" not registered. Live nodes: ${known}`)
  await broker.close()
  process.exit(1)
}

const id = crypto.randomUUID()
const replyTo = broker.allocReplyAddr(id)

// Start listening BEFORE sending — fast nodes may reply before we BLPOP.
const replyPromise = broker.streamReply(
  replyTo,
  (chunk) => {
    if (chunk.type === 'out') process.stdout.write(chunk.text)
    else process.stderr.write(chunk.text)
  },
  TIMEOUT_MS
)

const req: EvalRequest = { type: 'eval', id, source, replyTo }
await broker.send(targetId, req)

const reply = await replyPromise
await broker.close()

if (!reply) {
  console.error(`Timeout: no response from "${targetId}" within ${TIMEOUT_MS}ms`)
  process.exit(1)
}

if (reply.error) {
  console.error(reply.error)
  process.exit(1)
} else {
  console.log(`=> ${reply.value ?? 'nil'}`)
}
