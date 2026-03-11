/**
 * nREPL Mesh — standalone server node.
 *
 * Usage:
 *   bun src/server.ts [node-id]
 *
 * Starts a MeshNode that registers itself, listens for eval requests,
 * and keeps running until Ctrl+C.
 */

import { MeshNode } from './mesh-node.js'

const nodeId = process.argv[2] ?? `node-${crypto.randomUUID().slice(0, 8)}`
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const node = new MeshNode({ id: nodeId, redisUrl: REDIS_URL })

async function main() {
  await node.start()
  console.log(`[mesh] Node "${nodeId}" started — listening on Redis ${REDIS_URL}`)
  console.log(`[mesh] Connect with:  bun src/client.ts ${nodeId}`)
  console.log('[mesh] Press Ctrl+C to stop\n')

  process.on('SIGINT', async () => {
    console.log(`\n[mesh] Stopping node "${nodeId}"...`)
    await node.stop()
    process.exit(0)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
