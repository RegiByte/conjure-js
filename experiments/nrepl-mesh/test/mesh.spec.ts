/**
 * nREPL Mesh — same-process integration tests.
 *
 * Two nodes running in the same process, communicating through Redis.
 * Requires Redis on localhost:6379 (docker compose up in this folder).
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { MeshNode } from '../src/mesh-node.js'

describe('nREPL mesh — two nodes, one Redis', () => {
  let nodeA: MeshNode
  let nodeB: MeshNode

  beforeAll(async () => {
    nodeA = new MeshNode({ id: 'test-node-a' })
    nodeB = new MeshNode({ id: 'test-node-b' })
    await nodeA.start()
    await nodeB.start()
  }, 10_000)

  afterAll(async () => {
    await nodeA.stop()
    await nodeB.stop()
  })

  // --- basic eval ---

  test('node-a evals at node-b — arithmetic', async () => {
    const { result, error } = await nodeA.evalAt('test-node-b', '(+ 1 2)')
    expect(error).toBeUndefined()
    expect(result).toBe('3')
  })

  test('node-b evals at node-a — string op', async () => {
    const { result, error } = await nodeB.evalAt('test-node-a', '(str "hello" " world")')
    expect(error).toBeUndefined()
    expect(result).toBe('"hello world"')
  })

  test('eval returns keyword', async () => {
    const { result } = await nodeA.evalAt('test-node-b', ':some-key')
    expect(result).toBe(':some-key')
  })

  test('eval returns a vector', async () => {
    const { result } = await nodeA.evalAt('test-node-b', '[1 2 3]')
    expect(result).toBe('[1 2 3]')
  })

  test('eval returns a map', async () => {
    const { result } = await nodeA.evalAt('test-node-b', '{:a 1 :b 2}')
    expect(result).toBe('{:a 1 :b 2}')
  })

  // --- errors ---

  test('eval error — result is undefined, error is a string', async () => {
    const { result, error } = await nodeA.evalAt('test-node-b', '(/ 1 0)')
    expect(result).toBeUndefined()
    expect(typeof error).toBe('string')
    expect(error!.length).toBeGreaterThan(0)
  })

  test('unresolved symbol returns an error', async () => {
    const { result, error } = await nodeA.evalAt('test-node-b', 'undefined-sym')
    expect(result).toBeUndefined()
    expect(error).toBeTruthy()
  })

  test('(throw ...) returns an error with the thrown value', async () => {
    const { error } = await nodeA.evalAt('test-node-b', '(throw {:type :oops})')
    expect(error).toContain('Unhandled throw')
  })

  // --- state persistence ---

  test('session state persists between requests on the same node', async () => {
    await nodeA.evalAt('test-node-b', '(def remote-x 777)')
    const { result } = await nodeA.evalAt('test-node-b', 'remote-x')
    expect(result).toBe('777')
  })

  test('state on node-a is independent from node-b', async () => {
    await nodeA.evalAt('test-node-a', '(def local-y 111)')
    const { result: aResult } = await nodeA.evalAt('test-node-a', 'local-y')
    // node-b has no binding for local-y
    const { result: bResult, error: bError } = await nodeA.evalAt('test-node-b', 'local-y')
    expect(aResult).toBe('111')
    expect(bResult).toBeUndefined()
    expect(bError).toBeTruthy()
  })

  // --- async forms ---

  test('(async ...) form is evaluated and awaited transparently', async () => {
    const { result, error } = await nodeA.evalAt(
      'test-node-b',
      '(async (+ 1 @(promise-of 41)))'
    )
    expect(error).toBeUndefined()
    expect(result).toBe('42')
  })

  test('async rejection returns as error', async () => {
    const { error } = await nodeA.evalAt(
      'test-node-b',
      '(async (throw {:type :async-fail}))'
    )
    expect(error).toContain('Unhandled throw')
  })

  // --- node registry ---

  test('both nodes are visible in listNodes', async () => {
    const nodes = await nodeA.listNodes()
    const ids = nodes.map((n) => n.id)
    expect(ids).toContain('test-node-a')
    expect(ids).toContain('test-node-b')
  })

  test('stopped node is removed from registry', async () => {
    const tempNode = new MeshNode({ id: 'temp-node' })
    await tempNode.start()
    const before = await nodeA.listNodes()
    expect(before.map((n) => n.id)).toContain('temp-node')

    await tempNode.stop()
    const after = await nodeA.listNodes()
    expect(after.map((n) => n.id)).not.toContain('temp-node')
  })

  // --- timeout ---

  test('evalAt times out when target node does not exist', async () => {
    await expect(
      nodeA.evalAt('ghost-node', '(+ 1 2)', 500)
    ).rejects.toThrow('Timeout')
  }, 3_000)
})
