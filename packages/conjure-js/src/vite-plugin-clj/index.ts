import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { createSession } from '../core/session'
import type { Session } from '../core/session'
import { nsToPath, pathToNs } from './namespace-utils'
import { generateModuleCode, generateDts, safeJsIdentifier } from './codegen'
import type { CodegenContext } from './codegen'
import { startBrowserNreplRelay } from './nrepl-relay'

interface CljPluginOptions {
  sourceRoots?: string[]
  nreplPort?: number
}

// Resolve the conjure-js core index path regardless of whether this plugin
// is running from TypeScript source (src/vite-plugin-clj/) or the pre-built
// output (dist-vite-plugin/). Never use the consuming project's root.
function resolveCoreIndexPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url))
  // Source layout: packages/conjure-js/src/vite-plugin-clj/index.ts
  const fromSource = resolve(thisDir, '../core/index.ts')
  try {
    statSync(fromSource)
    return fromSource
  } catch {
    // Built layout: packages/conjure-js/dist-vite-plugin/index.mjs
    return resolve(thisDir, '../src/core/index.ts')
  }
}

const VIRTUAL_SESSION_ID = 'virtual:clj-session'
const RESOLVED_VIRTUAL_SESSION_ID = '\0' + VIRTUAL_SESSION_ID

export function cljPlugin(options?: CljPluginOptions): Plugin {
  const sourceRoots = options?.sourceRoots ?? ['src']
  let projectRoot = ''
  let serverSession: Session
  let coreIndexPath: string
  let codegenCtx: CodegenContext
  let generatorScriptPath: string
  let serveMode = false

  function writeFileIfChanged(path: string, content: string) {
    try {
      const existing = readFileSync(path, 'utf-8')
      if (existing === content) {
        return
      }
    } catch {
      // file does not exist yet
    }
    writeFileSync(path, content, 'utf-8')
  }

  function collectCljFiles(dir: string): string[] {
    let results: string[] = []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return results
    }
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          results = results.concat(collectCljFiles(fullPath))
        } else if (entry.endsWith('.clj')) {
          results.push(fullPath)
        }
      } catch {
        continue
      }
    }
    return results
  }

  function eagerlyGenerateDts() {
    for (const root of sourceRoots) {
      const rootPath = resolve(projectRoot, root)
      for (const filePath of collectCljFiles(rootPath)) {
        try {
          const source = readFileSync(filePath, 'utf-8')
          const nsNameFromPath = pathToNs(relative(projectRoot, filePath), sourceRoots)
          const dts = generateDts(codegenCtx, nsNameFromPath, source)
          writeFileIfChanged(filePath + '.d.ts', dts)
        } catch {
          continue
        }
      }
    }
  }

  function initServerSession() {
    serverSession = createSession({
      sourceRoots,
      readFile: (filePath: string) =>
        readFileSync(resolve(projectRoot, filePath), 'utf-8'),
      output: () => {},
    })
    codegenCtx = {
      session: serverSession,
      sourceRoots,
      coreIndexPath,
      virtualSessionId: VIRTUAL_SESSION_ID,
      resolveDepPath: (depNs: string) => {
        for (const root of sourceRoots) {
          const depPath = resolve(projectRoot, nsToPath(depNs, root))
          try {
            readFileSync(depPath)
            return depPath
          } catch {
            continue
          }
        }
        return null
      },
    }
  }

  function regenerateBuiltInNamespaceSources() {
    try {
      statSync(generatorScriptPath)
    } catch {
      // Script doesn't exist in this project — pre-built sources are already
      // included in the conjure-js package, no regeneration needed.
      return
    }
    try {
      execFileSync(process.execPath, [generatorScriptPath], {
        cwd: projectRoot,
        stdio: 'pipe',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate built-in namespace sources: ${message}`)
    }
  }

  return {
    name: 'vite-plugin-clj',

    configResolved(config: ResolvedConfig) {
      projectRoot = config.root
      serveMode = config.command === 'serve'
      generatorScriptPath = resolve(projectRoot, 'scripts/gen-core-source.mjs')
      regenerateBuiltInNamespaceSources()
      coreIndexPath = resolveCoreIndexPath()
      initServerSession()
      eagerlyGenerateDts()
    },

    configureServer(server: ViteDevServer) {
      startBrowserNreplRelay({
        port: options?.nreplPort,
        cwd: projectRoot,
        ws: server.ws,
        serverSession,
      })
    },

    resolveId(source: string) {
      if (source === VIRTUAL_SESSION_ID) {
        return RESOLVED_VIRTUAL_SESSION_ID
      }
      if (source.endsWith('.clj') && !source.includes('?')) {
        return null
      }
      return undefined
    },

    load(id: string) {
      if (id === RESOLVED_VIRTUAL_SESSION_ID) {
        const lines = [
          `import { createSession, printString } from ${JSON.stringify(coreIndexPath)};`,
          ``,
          `let _session = null;`,
          `let _outputLines = [];`,
          `export function getSession() {`,
          `  if (!_session) {`,
          `    _session = createSession({ output: (text) => { _outputLines.push(text); console.log(text.replace(/\\n$/, '')); } });`,
          `  }`,
          `  return _session;`,
          `}`,
        ]

        if (serveMode) {
          lines.push(
            ``,
            `// Browser nREPL relay — active only in Vite dev server`,
            `if (import.meta.hot) {`,
            `  import.meta.hot.on('conjure:eval', ({ id, code, ns }) => {`,
            `    const session = getSession();`,
            `    _outputLines = [];`,
            `    try {`,
            `      if (ns && ns !== session.currentNs) session.setNs(ns);`,
            `      const result = session.evaluate(code);`,
            `      const out = _outputLines.join('');`,
            `      import.meta.hot.send('conjure:eval-result', { id, value: printString(result), ns: session.currentNs, ...(out ? { out } : {}) });`,
            `    } catch (err) {`,
            `      console.error(err);`,
            `      const out = _outputLines.join('');`,
            `      import.meta.hot.send('conjure:eval-result', { id, error: err instanceof Error ? err.message : String(err), ns: session.currentNs, ...(out ? { out } : {}) });`,
            `    }`,
            `  });`,
            ``,
            `  import.meta.hot.on('conjure:load-file', ({ id, source, nsHint, filePath }) => {`,
            `    const session = getSession();`,
            `    _outputLines = [];`,
            `    try {`,
            `      const loadedNs = session.loadFile(source, nsHint, filePath || undefined);`,
            `      if (loadedNs) session.setNs(loadedNs);`,
            `      const out = _outputLines.join('');`,
            `      import.meta.hot.send('conjure:load-file-result', { id, value: 'nil', ns: session.currentNs, ...(out ? { out } : {}) });`,
            `    } catch (err) {`,
            `      console.error(err);`,
            `      const out = _outputLines.join('');`,
            `      import.meta.hot.send('conjure:load-file-result', { id, error: err instanceof Error ? err.message : String(err), ns: session.currentNs, ...(out ? { out } : {}) });`,
            `    }`,
            `  });`,
            `}`,
          )
        }

        return lines.join('\n')
      }

      if (id.endsWith('.clj') && !id.includes('?')) {
        const source = readFileSync(id, 'utf-8')
        const nsNameFromPath = pathToNs(relative(projectRoot, id), sourceRoots)
        const code = generateModuleCode(codegenCtx, nsNameFromPath, source)
        const dts = generateDts(codegenCtx, nsNameFromPath, source)
        writeFileIfChanged(id + '.d.ts', dts)
        return code
      }
    },

    hotUpdate({ file, modules, read }) {
      if (!file.endsWith('.clj')) return

      const doUpdate = async () => {
        if (file.startsWith(resolve(projectRoot, 'src/clojure') + '/')) {
          regenerateBuiltInNamespaceSources()
        }
        const source = await read()
        try {
          const nsNameFromPath = pathToNs(relative(projectRoot, file), sourceRoots)
          serverSession.loadFile(source, nsNameFromPath)
          const dts = generateDts(codegenCtx, nsNameFromPath, source)
          writeFileIfChanged(file + '.d.ts', dts)
        } catch {
          // file may not be under source roots
        }
        return modules
      }

      return doUpdate()
    },
  } satisfies Plugin
}

export { safeJsIdentifier, generateModuleCode, generateDts }
export type { CljPluginOptions, CodegenContext }
