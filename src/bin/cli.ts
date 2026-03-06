import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createSession, printString, type Session } from '../core'
import { extractNsName } from '../vite-plugin-clj/namespace-utils'

type CliIo = {
  writeLine: (text: string) => void
  writeError: (text: string) => void
}

function makeCliIo(): CliIo {
  return {
    writeLine: (text) => output.write(`${text}\n`),
    writeError: (text) => process.stderr.write(`${text}\n`),
  }
}

function createCliSession(sourceRoots: string[], io: CliIo): Session {
  return createSession({
    output: (text) => io.writeLine(text),
    sourceRoots,
    readFile: (filePath) => readFileSync(filePath, 'utf8'),
  })
}

function getSourceRoots(filePath?: string): string[] {
  const roots = new Set<string>()
  roots.add(process.cwd())
  if (filePath) {
    roots.add(dirname(filePath))
  }
  return [...roots]
}

function inferSourceRoot(filePath: string, source: string): string | null {
  const nsName = extractNsName(source)
  if (!nsName) return null

  const normalizedPath = filePath.replace(/\\/g, '/')
  const nsSuffix = `/${nsName.replace(/\./g, '/')}.clj`
  if (!normalizedPath.endsWith(nsSuffix)) {
    return null
  }

  return normalizedPath.slice(0, -nsSuffix.length) || '/'
}

function printUsage(io: CliIo) {
  io.writeLine('Usage:')
  io.writeLine('  regiclj repl')
  io.writeLine('  regiclj run <file.clj>')
}

export function runFile(fileArg: string, io: CliIo = makeCliIo()): number {
  const filePath = resolve(fileArg)
  if (!existsSync(filePath)) {
    io.writeError(`File not found: ${fileArg}`)
    return 1
  }

  try {
    const source = readFileSync(filePath, 'utf8')
    const inferredRoot = inferSourceRoot(filePath, source)
    const sourceRoots = inferredRoot
      ? [...new Set([inferredRoot, ...getSourceRoots(filePath)])]
      : getSourceRoots(filePath)

    const session = createCliSession(sourceRoots, io)
    session.loadFile(source)

    const nsName = extractNsName(source)
    if (nsName) {
      session.setNs(nsName)
    }

    return 0
  } catch (error) {
    io.writeError(error instanceof Error ? error.message : String(error))
    return 1
  }
}

function shouldExitRepl(source: string): boolean {
  const trimmed = source.trim()
  return trimmed === '.exit' || trimmed === ':quit'
}

function evaluateReplLine(session: Session, line: string, io: CliIo): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (shouldExitRepl(trimmed)) return false

  try {
    const result = session.evaluate(trimmed)
    io.writeLine(printString(result))
  } catch (error) {
    io.writeError(error instanceof Error ? error.message : String(error))
  }

  return true
}

async function startInteractiveRepl(
  session: Session,
  io: CliIo
): Promise<number> {
  const rl = createInterface({ input, output })
  try {
    while (true) {
      let line: string
      try {
        line = await rl.question(`${session.currentNs}=> `)
      } catch {
        break
      }

      if (!evaluateReplLine(session, line, io)) break
    }

    return 0
  } finally {
    rl.close()
  }
}

async function startStreamRepl(session: Session, io: CliIo): Promise<number> {
  const rl = createInterface({ input, output: process.stderr, terminal: false })

  try {
    for await (const line of rl) {
      if (!evaluateReplLine(session, line, io)) break
    }

    return 0
  } finally {
    rl.close()
  }
}

export async function startRepl(io: CliIo = makeCliIo()): Promise<number> {
  const session = createCliSession(getSourceRoots(), io)

  io.writeLine('RegiByte Clojure REPL')
  io.writeLine("Type .exit or :quit to exit.")

  if (!input.isTTY) {
    return startStreamRepl(session, io)
  }

  return startInteractiveRepl(session, io)
}

export async function runCli(
  args: string[],
  io: CliIo = makeCliIo()
): Promise<number> {
  const [command, ...rest] = args

  if (!command || command === 'repl') {
    return startRepl(io)
  }

  if (command === 'run') {
    const [fileArg] = rest
    if (!fileArg) {
      printUsage(io)
      return 1
    }
    return runFile(fileArg, io)
  }

  printUsage(io)
  return 1
}

const entryPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === entryPath) {
  const exitCode = await runCli(process.argv.slice(2))
  process.exitCode = exitCode
}
