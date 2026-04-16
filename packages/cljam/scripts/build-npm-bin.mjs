#!/usr/bin/env node
/**
 * Build the cljam CLI to a self-contained Node.js bundle using esbuild.
 *
 * Output: dist-cli/cljam.mjs — a single ESM file with a #!/usr/bin/env node
 * shebang, executable by Node.js 18+ without any additional tooling.
 *
 * Run with: node scripts/build-npm-bin.mjs
 */

import { build } from 'esbuild'
import { mkdirSync, chmodSync } from 'node:fs'

mkdirSync('dist-cli', { recursive: true })

await build({
  entryPoints: ['src/bin/cli.ts'],
  bundle: true,
  outfile: 'dist-cli/cljam.mjs',
  platform: 'node',
  format: 'esm',
  target: ['node18'],
  minify: true,
  // #!/usr/bin/env node shebang so npm/npx can execute the file directly
  banner: { js: '#!/usr/bin/env node' },
})

chmodSync('dist-cli/cljam.mjs', 0o755)
console.log('Built dist-cli/cljam.mjs')
