#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

const usage = `Usage:
  pnpm ts:symbol-references -- --project <tsconfig> --file <file> --symbol <name> [--line <line> --column <column>]

Example:
  pnpm ts:symbol-references -- --project packages/router-core/tsconfig.json --file packages/router-core/src/utils.ts --symbol last
`

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

if (!args.project || !args.file || !args.symbol) {
  fail(usage)
}

const cwd = process.cwd()
const projectPath = resolve(cwd, args.project)
const targetFile = resolve(cwd, args.file)

if (!existsSync(projectPath)) {
  fail(`Project not found: ${args.project}`)
}

if (!existsSync(targetFile)) {
  fail(`File not found: ${args.file}`)
}

const configFile = ts.readConfigFile(projectPath, ts.sys.readFile)
if (configFile.error) {
  fail(formatDiagnostics([configFile.error]))
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  dirname(projectPath),
  undefined,
  projectPath,
)

if (parsedConfig.errors.length) {
  fail(formatDiagnostics(parsedConfig.errors))
}

const fileNames = Array.from(new Set([...parsedConfig.fileNames, targetFile]))
const fileTextCache = new Map()
const service = ts.createLanguageService({
  getCompilationSettings: () => parsedConfig.options,
  getCurrentDirectory: () => dirname(projectPath),
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  getDirectories: ts.sys.getDirectories,
  getNewLine: () => ts.sys.newLine,
  getScriptFileNames: () => fileNames,
  getScriptSnapshot(fileName) {
    const text = getFileText(fileName)
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
  },
  getScriptVersion: () => '0',
  readDirectory: ts.sys.readDirectory,
  readFile: ts.sys.readFile,
  fileExists: ts.sys.fileExists,
  directoryExists: ts.sys.directoryExists,
  useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  realpath: ts.sys.realpath,
})

const program = service.getProgram()
const sourceFile = program
  ?.getSourceFiles()
  .find((source) => resolve(source.fileName) === targetFile)

if (!sourceFile) {
  fail(`File is not in the TypeScript program: ${args.file}`)
}

const symbolNode = findSymbolNode(
  sourceFile,
  args.symbol,
  args.line,
  args.column,
)
const refs = service.findReferences(
  sourceFile.fileName,
  symbolNode.getStart(sourceFile),
)

if (!refs?.length) {
  fail(`No references found for ${args.symbol}`)
}

const rows = dedupeReferences(refs)
console.log(
  `Found ${rows.length} references for ${args.symbol} at ${formatLocation(sourceFile, symbolNode.getStart(sourceFile))}`,
)

for (const row of rows) {
  const source = program?.getSourceFile(row.fileName)
  if (!source) continue

  const location = formatLocation(source, row.textSpan.start)
  const line = getLineText(row.fileName, source, row.textSpan.start)
  const marker = row.isDefinition ? ' [definition]' : ''
  console.log(`${location}${marker} ${line}`)
}

function parseArgs(rawArgs) {
  const parsed = {}
  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index]

    if (arg === '--') {
      continue
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }

    if (!arg.startsWith('--')) {
      fail(`Unexpected argument: ${arg}\n\n${usage}`)
    }

    const key = arg.slice(2)
    const value = rawArgs[index + 1]
    if (!value || value.startsWith('--')) {
      fail(`Missing value for --${key}\n\n${usage}`)
    }

    parsed[key] = value
    index++
  }

  return parsed
}

function findSymbolNode(sourceFile, symbol, line, column) {
  if (line !== undefined || column !== undefined) {
    if (line === undefined || column === undefined) {
      fail('Pass both --line and --column, or neither.')
    }

    const lineNumber = Number(line)
    const columnNumber = Number(column)
    if (!Number.isInteger(lineNumber) || !Number.isInteger(columnNumber)) {
      fail('--line and --column must be integers.')
    }

    const position = sourceFile.getPositionOfLineAndCharacter(
      lineNumber - 1,
      columnNumber - 1,
    )
    const node = findIdentifierAtPosition(sourceFile, position)
    if (!node) {
      fail(`No identifier at ${line}:${column}`)
    }

    if (node.text !== symbol) {
      fail(`Identifier at ${line}:${column} is ${node.text}, not ${symbol}`)
    }

    return node
  }

  const candidates = []
  visitIdentifiers(sourceFile, (node) => {
    if (node.text === symbol) candidates.push(node)
  })

  if (!candidates.length) {
    fail(`Symbol not found in ${relative(cwd, sourceFile.fileName)}: ${symbol}`)
  }

  const declarations = candidates.filter(isDeclarationName)
  if (declarations.length === 1) {
    return declarations[0]
  }

  const options = (declarations.length ? declarations : candidates)
    .map((node) => `  ${formatLocation(sourceFile, node.getStart(sourceFile))}`)
    .join('\n')

  fail(`Symbol is ambiguous. Pass --line and --column for one of:\n${options}`)
}

function visitIdentifiers(node, onIdentifier) {
  if (ts.isIdentifier(node)) {
    onIdentifier(node)
  }
  ts.forEachChild(node, (child) => visitIdentifiers(child, onIdentifier))
}

function findIdentifierAtPosition(sourceFile, position) {
  let match
  visitIdentifiers(sourceFile, (node) => {
    const start = node.getStart(sourceFile)
    const end = node.getEnd()
    if (start <= position && position <= end) {
      match = node
    }
  })
  return match
}

function isDeclarationName(node) {
  const parent = node.parent
  if (!parent || parent.name !== node) return false

  return (
    ts.isClassDeclaration(parent) ||
    ts.isEnumDeclaration(parent) ||
    ts.isFunctionDeclaration(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isInterfaceDeclaration(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isModuleDeclaration(parent) ||
    ts.isParameter(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent) ||
    ts.isTypeAliasDeclaration(parent) ||
    ts.isVariableDeclaration(parent)
  )
}

function dedupeReferences(refs) {
  const seen = new Set()
  const rows = []

  for (const group of refs) {
    for (const reference of group.references) {
      const key = `${resolve(reference.fileName)}:${reference.textSpan.start}:${reference.textSpan.length}`
      if (seen.has(key)) continue

      seen.add(key)
      rows.push(reference)
    }
  }

  rows.sort((left, right) => {
    const fileCompare = relative(cwd, left.fileName).localeCompare(
      relative(cwd, right.fileName),
    )
    return fileCompare || left.textSpan.start - right.textSpan.start
  })

  return rows
}

function getFileText(fileName) {
  if (fileTextCache.has(fileName)) return fileTextCache.get(fileName)
  if (!existsSync(fileName)) return undefined

  const text = readFileSync(fileName, 'utf8')
  fileTextCache.set(fileName, text)
  return text
}

function getLineText(fileName, sourceFile, position) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(position)
  return getFileText(fileName)?.split(/\r?\n/)[line]?.trim() ?? ''
}

function formatLocation(sourceFile, position) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position)
  return `${relative(cwd, sourceFile.fileName)}:${line + 1}:${character + 1}`
}

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => cwd,
    getNewLine: () => ts.sys.newLine,
  })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
