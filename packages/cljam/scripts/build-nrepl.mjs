#!/usr/bin/env node
/**
 * Build the cljam nREPL server to a self-contained Node.js bundle using esbuild.
 *
 * Output: dist-nrepl/index.mjs — all of nrepl.ts + its deps bundled together.
 * Used as the `default` condition in the "./nrepl" package export so that
 * Node.js (and any non-Bun runtime) can import it without tsx or a TypeScript loader.
 *
 * Run with: node scripts/build-nrepl.mjs
 */

import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('dist-nrepl', { recursive: true })

await build({
  entryPoints: ['src/bin/nrepl.ts'],
  bundle: true,
  outfile: 'dist-nrepl/index.mjs',
  platform: 'node',
  format: 'esm',
  target: ['node18'],
})

console.log('Built dist-nrepl/index.mjs')
