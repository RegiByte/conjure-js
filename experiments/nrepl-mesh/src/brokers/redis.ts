/**
 * RedisBroker — MeshBroker implementation backed by Redis.
 *
 * Transport mechanics:
 *   - send()       → PUBLISH mesh:req:{nodeId}
 *   - subscribe()  → SUBSCRIBE mesh:req:{nodeId}
 *   - reply()      → LPUSH mesh:reply:{id}  +  EXPIRE
 *   - awaitReply() → BLPOP mesh:reply:{id}  (dedicated per-call connection)
 *   - register()   → HSET mesh:nodes {id} <JSON>
 *   - deregister() → HDEL mesh:nodes {id}
 *   - discover()   → HGETALL mesh:nodes, filter live nodes by lastSeen recency,
 *                    auto-remove stale entries (fire-and-forget HDEL)
 *
 * The `replyAddr` is a Redis list key; its meaning is opaque to callers.
 * Stale reply keys expire automatically (REPLY_TTL_SEC).
 *
 * Note on connections:
 *   `pub` handles all write commands. `sub` is dedicated to SUBSCRIBE (Redis
 *   requires a connection in subscriber mode to not mix commands).
 *   Each awaitReply() call opens a temporary third connection for BLPOP, since
 *   BLPOP monopolises the connection while blocking.
 */

import Redis from 'ioredis'
import type { MeshBroker, NodeInfo, Unsubscribe } from '../broker.js'
import type { MeshMessage, MeshReply, MeshStreamChunk } from '../protocol.js'

const NODES_KEY = 'mesh:nodes'
const REPLY_TTL_SEC = 30

const reqChannel = (nodeId: string) => `mesh:req:${nodeId}`
const replyKey = (correlationId: string) => `mesh:reply:${correlationId}`

/**
 * How long after the last heartbeat a node is considered stale.
 * Default: 30 000 ms (≈ 4× the default heartbeat interval of 7 s).
 * Stale nodes are excluded from discover() and cleaned up from Redis
 * automatically on the next discover() call.
 */
const DEFAULT_STALE_THRESHOLD_MS = 30_000

export type RedisBrokerOptions = {
  url?: string
  /** Override the stale-node threshold (ms). Default: 30 000. */
  staleThresholdMs?: number
}

export class RedisBroker implements MeshBroker {
  private readonly url: string
  private readonly staleThresholdMs: number
  private pub: Redis
  private sub: Redis

  constructor(opts: RedisBrokerOptions = {}) {
    this.url = opts.url ?? 'redis://localhost:6379'
    this.staleThresholdMs = opts.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS
    this.pub = new Redis(this.url)
    this.sub = new Redis(this.url)
  }

  async send(nodeId: string, msg: MeshMessage): Promise<void> {
    await this.pub.publish(reqChannel(nodeId), JSON.stringify(msg))
  }

  async subscribe(nodeId: string, handler: (msg: MeshMessage) => void): Promise<Unsubscribe> {
    await this.sub.subscribe(reqChannel(nodeId))

    const listener = (channel: string, raw: string) => {
      if (channel !== reqChannel(nodeId)) return
      try {
        handler(JSON.parse(raw) as MeshMessage)
      } catch {
        // malformed message — ignore
      }
    }

    this.sub.on('message', listener)

    return async () => {
      this.sub.off('message', listener)
      await this.sub.unsubscribe(reqChannel(nodeId))
    }
  }

  async sendChunk(replyAddr: string, chunk: MeshStreamChunk): Promise<void> {
    // RPUSH + BLPOP = FIFO queue: chunks are read in the order they were sent.
    // LPUSH + BLPOP would be LIFO — the terminal eval-reply (pushed last) would
    // be read first, causing the loop to exit before any chunk is consumed.
    await this.pub.rpush(replyAddr, JSON.stringify(chunk))
    await this.pub.expire(replyAddr, REPLY_TTL_SEC)
  }

  async reply(replyAddr: string, reply: MeshReply): Promise<void> {
    await this.pub.rpush(replyAddr, JSON.stringify(reply))
    await this.pub.expire(replyAddr, REPLY_TTL_SEC)
  }

  async streamReply(
    replyAddr: string,
    onChunk: (chunk: MeshStreamChunk) => void,
    timeoutMs: number
  ): Promise<MeshReply | null> {
    // A dedicated connection is required: BLPOP blocks the connection.
    const blocker = new Redis(this.url)
    const deadline = Date.now() + timeoutMs
    try {
      while (true) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) return null
        const timeoutSec = Math.max(1, Math.ceil(remaining / 1000))
        const res = await blocker.blpop(replyAddr, timeoutSec)
        if (!res) return null
        const msg = JSON.parse(res[1]) as MeshReply | MeshStreamChunk
        if (msg.type === 'eval-reply') return msg as MeshReply
        onChunk(msg as MeshStreamChunk)
      }
    } finally {
      blocker.disconnect()
    }
  }

  async awaitReply(replyAddr: string, timeoutMs: number): Promise<MeshReply | null> {
    return this.streamReply(replyAddr, () => {}, timeoutMs)
  }

  allocReplyAddr(correlationId: string): string {
    return replyKey(correlationId)
  }

  async register(info: NodeInfo): Promise<void> {
    await this.pub.hset(NODES_KEY, info.id, JSON.stringify(info))
  }

  async deregister(nodeId: string): Promise<void> {
    await this.pub.hdel(NODES_KEY, nodeId)
  }

  async discover(capability?: string): Promise<NodeInfo[]> {
    const raw = await this.pub.hgetall(NODES_KEY)
    if (!raw) return []

    const now = Date.now()
    const staleIds: string[] = []
    const live: NodeInfo[] = []

    for (const [id, json] of Object.entries(raw)) {
      const info = JSON.parse(json) as NodeInfo
      if (now - info.lastSeen >= this.staleThresholdMs) {
        staleIds.push(id)
      } else {
        live.push(info)
      }
    }

    // Auto-clean stale entries so they don't accumulate across sessions.
    if (staleIds.length > 0) {
      void this.pub.hdel(NODES_KEY, ...staleIds)
    }

    if (!capability) return live
    return live.filter((n) => n.capabilities?.includes(capability))
  }

  async close(): Promise<void> {
    this.sub.disconnect()
    this.pub.disconnect()
  }
}

export function createRedisBroker(opts?: RedisBrokerOptions): RedisBroker {
  return new RedisBroker(opts)
}
