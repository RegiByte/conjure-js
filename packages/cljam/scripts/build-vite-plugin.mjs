#!/usr/bin/env node
/**
 * Build the cljam vite plugin to a self-contained Node.js bundle using esbuild.
 *
 * Output: dist-vite-plugin/index.mjs — vite is kept external (peer dependency).
 *
 * Run with: node scripts/build-vite-plugin.mjs
 */

import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('dist-vite-plugin', { recursive: true })

await build({
  entryPoints: ['src/vite-plugin-cljam/index.ts'],
  bundle: true,
  outfile: 'dist-vite-plugin/index.mjs',
  platform: 'node',
  format: 'esm',
  // vite is a peer dependency — don't bundle it
  external: ['vite'],
})

console.log('Built dist-vite-plugin/index.mjs')
