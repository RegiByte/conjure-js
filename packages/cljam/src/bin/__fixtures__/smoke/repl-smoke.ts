import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve packages/cljam/ root regardless of where tests are run from
const pkgRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..')

const input = '(def x 41)\n(+ x 1)\n(exit)\n'

// Run the pre-built bundle so the smoke test works with both Node.js and Bun.
// During development with bun, fall back to running the TypeScript source directly.
const hasBun = typeof globalThis.Bun !== 'undefined'
const cmd = hasBun
  ? ['bun', 'run', 'src/bin/cli.ts', 'repl']
  : ['node', 'dist-cli/cljam.mjs', 'repl']

const result = spawnSync(cmd[0], cmd.slice(1), {
  cwd: pkgRoot,
  input,
  encoding: 'utf8',
})

process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
process.exit(result.status ?? 1)
