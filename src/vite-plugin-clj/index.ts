import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { createSession } from '../core/session'
import type { Session } from '../core/session'
import { nsToPath, pathToNs } from './namespace-utils'
import { generateModuleCode, generateDts, safeJsIdentifier } from './codegen'
import type { CodegenContext } from './codegen'

interface CljPluginOptions {
  sourceRoots?: string[]
}

const VIRTUAL_SESSION_ID = 'virtual:clj-session'
const RESOLVED_VIRTUAL_SESSION_ID = '\0' + VIRTUAL_SESSION_ID

export function cljPlugin(options?: CljPluginOptions): Plugin {
  const sourceRoots = options?.sourceRoots ?? ['src']
  let projectRoot = ''
  let serverSession: Session
  let coreIndexPath: string
  let macrosPath: string
  let codegenCtx: CodegenContext

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
          writeFileSync(filePath + '.d.ts', dts, 'utf-8')
        } catch {
          continue
        }
      }
    }
  }

  function initServerSession() {
    serverSession = createSession({
      entries: [readFileSync(macrosPath, 'utf-8')],
      sourceRoots,
      readFile: (filePath: string) =>
        readFileSync(resolve(projectRoot, filePath), 'utf-8'),
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

  return {
    name: 'vite-plugin-clj',

    configResolved(config: ResolvedConfig) {
      projectRoot = config.root
      coreIndexPath = resolve(projectRoot, 'src/core/index.ts')
      macrosPath = resolve(projectRoot, 'src/clojure/macros.clj')
      initServerSession()
      eagerlyGenerateDts()
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
        return [
          `import { createSession } from ${JSON.stringify(coreIndexPath)};`,
          `import macrosSource from ${JSON.stringify(macrosPath + '?raw')};`,
          ``,
          `let _session = null;`,
          `export function getSession() {`,
          `  if (!_session) {`,
          `    _session = createSession({ entries: [macrosSource] });`,
          `  }`,
          `  return _session;`,
          `}`,
        ].join('\n')
      }

      if (id.endsWith('.clj') && !id.includes('?')) {
        const source = readFileSync(id, 'utf-8')
        const nsNameFromPath = pathToNs(relative(projectRoot, id), sourceRoots)
        const code = generateModuleCode(codegenCtx, nsNameFromPath, source)
        const dts = generateDts(codegenCtx, nsNameFromPath, source)
        writeFileSync(id + '.d.ts', dts, 'utf-8')
        return code
      }
    },

    hotUpdate({ file, modules, read }) {
      if (!file.endsWith('.clj')) return

      const doUpdate = async () => {
        const source = await read()
        try {
          const nsNameFromPath = pathToNs(relative(projectRoot, file), sourceRoots)
          serverSession.loadFile(source, nsNameFromPath)
          const dts = generateDts(codegenCtx, nsNameFromPath, source)
          writeFileSync(file + '.d.ts', dts, 'utf-8')
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
