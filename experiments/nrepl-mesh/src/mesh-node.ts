/**
 * MeshNode — a Conjure session connected to the Redis mesh.
 *
 * Each node:
 *   - Registers itself in the node registry on start
 *   - Subscribes to its own request channel and evaluates incoming forms
 *   - Exposes evalAt() to send a form to another node and await the result
 *   - Exposes listNodes() to inspect the current node registry
 *
 * Wire contract: forms travel as raw source strings; results travel as
 * printString(CljValue) — EDN-printable output only. Non-printable results
 * (functions, lazy seqs) still print, but can't be re-read as data.
 * Async forms (async ...) are evaluated transparently via evaluateAsync.
 */

import Redis from 'ioredis'
import { createSession, printString } from 'conjure-js'
import {
  NODES_KEY,
  REPLY_TTL_SEC,
  reqChannel,
  replyListKey,
} from './protocol.js'
import type { MeshRequest, MeshResponse, NodeInfo } from './protocol.js'

export type MeshNodeOptions = {
  id?: string
  redisUrl?: string
}

export class MeshNode {
  readonly id: string
  private readonly redisUrl: string
  private readonly session = createSession()
  private pub: Redis
  private sub: Redis
  private running = false

  constructor(opts: MeshNodeOptions = {}) {
    this.id = opts.id ?? `node-${crypto.randomUUID().slice(0, 8)}`
    this.redisUrl = opts.redisUrl ?? 'redis://localhost:6379'
    this.pub = new Redis(this.redisUrl, { lazyConnect: true })
    this.sub = new Redis(this.redisUrl, { lazyConnect: true })
  }

  async start(): Promise<void> {
    if (this.running) return
    await this.pub.connect()
    await this.sub.connect()
    this.running = true

    // Register in the shared node registry
    const info: NodeInfo = { id: this.id, startedAt: Date.now() }
    await this.pub.hset(NODES_KEY, this.id, JSON.stringify(info))

    // Listen for eval requests on our channel
    await this.sub.subscribe(reqChannel(this.id))
    this.sub.on('message', (channel, raw) => {
      if (channel !== reqChannel(this.id)) return
      void this.onRequest(raw)
    })
  }

  private async onRequest(raw: string): Promise<void> {
    let req: MeshRequest
    try {
      req = JSON.parse(raw) as MeshRequest
    } catch {
      return
    }
    const response = await this.handleEval(req)
    // Push reply to the list key and set a TTL so stale replies self-clean
    await this.pub.lpush(req.replyKey, JSON.stringify(response))
    await this.pub.expire(req.replyKey, REPLY_TTL_SEC)
  }

  private async handleEval(req: MeshRequest): Promise<MeshResponse> {
    try {
      // evaluateAsync transparently awaits (async ...) forms
      const result = await this.session.evaluateAsync(req.form)
      return { reqId: req.reqId, result: printString(result) }
    } catch (e) {
      return {
        reqId: req.reqId,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  async evalAt(
    targetId: string,
    form: string,
    timeoutMs = 10_000
  ): Promise<MeshResponse> {
    const reqId = crypto.randomUUID()
    const replyKey = replyListKey(reqId)
    const request: MeshRequest = { reqId, form, replyKey }

    // A separate connection is required for BLPOP — it blocks the connection
    // while waiting, so it can't share pub or sub.
    const blocker = new Redis(this.redisUrl)
    try {
      // Start BLPOP before publishing so we can't miss a fast reply.
      // BLPOP returns immediately if the key already has data, so no deadlock.
      const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000))
      const blpopPromise = blocker.blpop(replyKey, timeoutSec)

      await this.pub.publish(reqChannel(targetId), JSON.stringify(request))

      const res = await blpopPromise
      if (!res) {
        throw new Error(
          `Timeout: no response from node "${targetId}" within ${timeoutMs}ms`
        )
      }
      return JSON.parse(res[1]) as MeshResponse
    } finally {
      blocker.disconnect()
    }
  }

  async listNodes(): Promise<NodeInfo[]> {
    const raw = await this.pub.hgetall(NODES_KEY)
    return Object.values(raw).map((v) => JSON.parse(v) as NodeInfo)
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    await this.pub.hdel(NODES_KEY, this.id)
    this.sub.disconnect()
    this.pub.disconnect()
  }
}
