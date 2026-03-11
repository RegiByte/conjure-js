/**
 * nREPL Mesh — wire protocol constants and types.
 *
 * Transport: Redis pub/sub for requests, Redis list + BLPOP for responses.
 *
 * Channels / keys:
 *   mesh:nodes            HSET  — node registry (id → NodeInfo JSON)
 *   mesh:req:{nodeId}     PUBSUB channel — incoming eval requests to that node
 *   mesh:reply:{reqId}    LIST  — single-item list, node pushes reply here
 */

export const NODES_KEY = 'mesh:nodes'
export const reqChannel = (nodeId: string) => `mesh:req:${nodeId}`
export const replyListKey = (reqId: string) => `mesh:reply:${reqId}`

/** How long (seconds) a reply list key lives before expiring. */
export const REPLY_TTL_SEC = 30

export type NodeInfo = {
  id: string
  startedAt: number
}

export type MeshRequest = {
  reqId: string
  /** Raw Clojure/EDN source string to evaluate. */
  form: string
  /** Redis list key where the node should push the response. */
  replyKey: string
}

export type MeshResponse = {
  reqId: string
  /** printString of the result value, if evaluation succeeded. */
  result?: string
  /** Error message string, if evaluation failed. */
  error?: string
}
