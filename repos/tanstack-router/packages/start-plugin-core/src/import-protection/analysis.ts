import * as t from '@babel/types'
import { parseAst } from '@tanstack/router-utils'

import { buildLineIndex } from './sourceLocation'
import { getOrCreate } from './utils'
import type { LineIndex, TransformResult } from './sourceLocation'
import type { ParseAstResult } from '@tanstack/router-utils'

export type UsagePos = { line: number; column0: number }

type BoundaryEnv = 'client' | 'server'

type ImportBindingInfo = {
  importedLocalNames: Set<string>
}

type UsageCacheKey = `${BoundaryEnv | 'post'}::${string}`

function mayContainImportOrExport(code: string): boolean {
  return code.includes('import') || code.includes('export')
}

export type ImportAnalysis = {
  ast: ParseAstResult
  lineIndex: LineIndex
  importSourcesInOrder: Array<string>
  importSpecifierLocationIndex: Map<string, number>
  importBindingsBySource: Map<string, ImportBindingInfo>
  mockExportNamesBySource: Map<string, Array<string>>
  namedExports: Array<string>
  usageByKey: Map<UsageCacheKey, UsagePos | null>
}

function makeTransientResult(
  code: string,
  filename?: string,
  perf?: TransformResult['perf'],
): TransformResult {
  const result: TransformResult = {
    code,
    filename,
    map: undefined,
    originalCode: undefined,
  }

  if (perf) {
    result.perf = perf
  }

  return result
}

function getOrParseAst(result: TransformResult): ParseAstResult {
  if (result.parsedAst) {
    result.perf?.count('analysis.parseAst.cached')
    return result.parsedAst
  }

  const startedAt = result.perf ? performance.now() : 0
  result.perf?.count('analysis.parseAst.calls')

  try {
    const ast = parseAst({ code: result.code, filename: result.filename })
    result.parsedAst = ast
    return ast
  } finally {
    if (result.perf) {
      result.perf.time('analysis.parseAst', startedAt)
    }
  }
}

function getModuleExportName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value
}

function getStringLiteralValueStart(node: t.StringLiteral): number {
  if (node.start == null) {
    return -1
  }

  const raw = node.extra?.raw
  if (typeof raw === 'string' && (raw.startsWith("'") || raw.startsWith('"'))) {
    return node.start + 1
  }

  return node.start
}

function isTypeOnlyImportDeclaration(node: t.ImportDeclaration): boolean {
  if (node.importKind === 'type') return true
  if (node.specifiers.length === 0) return false

  return node.specifiers.every(
    (specifier) =>
      t.isImportSpecifier(specifier) && specifier.importKind === 'type',
  )
}

function isTypeOnlyExportNamedDeclaration(
  node: t.ExportNamedDeclaration,
): boolean {
  if (node.exportKind === 'type') return true
  if (!node.source || node.declaration || node.specifiers.length === 0) {
    return false
  }

  return node.specifiers.every(
    (specifier) =>
      t.isExportSpecifier(specifier) && specifier.exportKind === 'type',
  )
}

function collectIdentifiersFromPattern(
  pattern: t.LVal,
  add: (name: string) => void,
): void {
  if (t.isIdentifier(pattern)) {
    add(pattern.name)
  } else if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        collectIdentifiersFromPattern(prop.argument as t.LVal, add)
      } else {
        collectIdentifiersFromPattern(prop.value as t.LVal, add)
      }
    }
  } else if (t.isArrayPattern(pattern)) {
    for (const elem of pattern.elements) {
      if (elem) collectIdentifiersFromPattern(elem as t.LVal, add)
    }
  } else if (t.isAssignmentPattern(pattern)) {
    collectIdentifiersFromPattern(pattern.left, add)
  } else if (t.isRestElement(pattern)) {
    collectIdentifiersFromPattern(pattern.argument as t.LVal, add)
  }
}

export function isValidExportName(name: string): boolean {
  if (name === 'default' || name.length === 0) return false
  const first = name.charCodeAt(0)
  if (
    !(
      (first >= 65 && first <= 90) ||
      (first >= 97 && first <= 122) ||
      first === 95 ||
      first === 36
    )
  )
    return false
  for (let i = 1; i < name.length; i++) {
    const ch = name.charCodeAt(i)
    if (
      !(
        (ch >= 65 && ch <= 90) ||
        (ch >= 97 && ch <= 122) ||
        (ch >= 48 && ch <= 57) ||
        ch === 95 ||
        ch === 36
      )
    )
      return false
  }
  return true
}

function buildImportAnalysis(result: TransformResult): ImportAnalysis {
  const ast = getOrParseAst(result)

  const importSourcesInOrder: Array<string> = []
  const importSpecifierLocationIndex = new Map<string, number>()
  const importBindingsBySource = new Map<string, ImportBindingInfo>()
  const memberBindingSources = new Map<string, Set<string>>()
  const mockNamesBySource = new Map<string, Set<string>>()
  const namedExports = new Set<string>()

  const getBindingInfo = (source: string): ImportBindingInfo =>
    getOrCreate(importBindingsBySource, source, () => ({
      importedLocalNames: new Set<string>(),
    }))

  const addSpecifierLocation = (node: t.StringLiteral) => {
    importSourcesInOrder.push(node.value)

    const index = getStringLiteralValueStart(node)
    if (index === -1) {
      return
    }

    const prev = importSpecifierLocationIndex.get(node.value)
    if (prev == null || index < prev) {
      importSpecifierLocationIndex.set(node.value, index)
    }
  }

  const addMockName = (source: string, name: string) => {
    if (name === 'default' || name.length === 0) return
    getOrCreate(mockNamesBySource, source, () => new Set<string>()).add(name)
  }

  const addMemberBinding = (localName: string, source: string) => {
    getOrCreate(memberBindingSources, localName, () => new Set<string>()).add(
      source,
    )
  }

  const addNamedExport = (name: string) => {
    if (name !== 'default' && name.length > 0) {
      namedExports.add(name)
    }
  }

  const visit = (node: t.Node): void => {
    if (t.isImportDeclaration(node)) {
      const isTypeOnly = isTypeOnlyImportDeclaration(node)
      if (!isTypeOnly) {
        addSpecifierLocation(node.source)
        const source = node.source.value
        const bindingInfo = getBindingInfo(source)
        for (const specifier of node.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier)) {
            bindingInfo.importedLocalNames.add(specifier.local.name)
            addMemberBinding(specifier.local.name, source)
            continue
          }

          if (t.isImportDefaultSpecifier(specifier)) {
            bindingInfo.importedLocalNames.add(specifier.local.name)
            addMemberBinding(specifier.local.name, source)
            continue
          }

          if (!t.isImportSpecifier(specifier)) continue
          if (specifier.importKind === 'type') continue

          bindingInfo.importedLocalNames.add(specifier.local.name)
          const importedName = getModuleExportName(specifier.imported)
          if (importedName !== 'default') {
            addMockName(source, importedName)
          }
        }
      }
    } else if (t.isExportNamedDeclaration(node)) {
      const isTypeOnly = isTypeOnlyExportNamedDeclaration(node)
      if (!isTypeOnly && node.source && t.isStringLiteral(node.source)) {
        addSpecifierLocation(node.source)
      }

      if (!isTypeOnly && node.source?.value) {
        const source = node.source.value
        for (const specifier of node.specifiers) {
          if (!t.isExportSpecifier(specifier)) continue
          if (specifier.exportKind === 'type') continue
          addMockName(source, getModuleExportName(specifier.local))
        }
      }

      if (!isTypeOnly) {
        if (node.declaration) {
          const decl = node.declaration
          if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
            if (decl.id?.name) addNamedExport(decl.id.name)
          } else if (t.isVariableDeclaration(decl)) {
            for (const d of decl.declarations) {
              collectIdentifiersFromPattern(d.id as t.LVal, addNamedExport)
            }
          }
        }

        for (const specifier of node.specifiers) {
          if (!t.isExportSpecifier(specifier)) continue
          if (specifier.exportKind === 'type') continue
          const exportedName = getModuleExportName(specifier.exported)
          addNamedExport(exportedName)
        }
      }
    } else if (t.isExportAllDeclaration(node)) {
      if (node.exportKind !== 'type') {
        addSpecifierLocation(node.source)
      }
    } else if (t.isImportExpression(node)) {
      if (t.isStringLiteral(node.source)) {
        addSpecifierLocation(node.source)
      }
    } else if (t.isCallExpression(node) && t.isImport(node.callee)) {
      const sourceNode = node.arguments[0]
      if (t.isStringLiteral(sourceNode)) {
        addSpecifierLocation(sourceNode)
      }
    } else if (
      t.isMemberExpression(node) ||
      t.isOptionalMemberExpression(node)
    ) {
      const object = node.object
      if (t.isIdentifier(object)) {
        const sources = memberBindingSources.get(object.name)
        if (sources) {
          const property = node.property
          for (const source of sources) {
            if (!node.computed && t.isIdentifier(property)) {
              addMockName(source, property.name)
            } else if (node.computed && t.isStringLiteral(property)) {
              addMockName(source, property.value)
            }
          }
        }
      }
    }

    const keys = t.VISITOR_KEYS[node.type]
    if (!keys) return
    for (const key of keys) {
      const child = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            visit(item as t.Node)
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        visit(child as t.Node)
      }
    }
  }

  visit(ast.program)

  const mockExportNamesBySource = new Map<string, Array<string>>()
  for (const [source, names] of mockNamesBySource) {
    mockExportNamesBySource.set(source, Array.from(names).sort())
  }

  const lineIndex = result.lineIndex ?? buildLineIndex(result.code)
  result.lineIndex = lineIndex

  const analysis = {
    ast,
    lineIndex,
    importSourcesInOrder,
    importSpecifierLocationIndex,
    importBindingsBySource,
    mockExportNamesBySource,
    namedExports: Array.from(namedExports).sort(),
    usageByKey: new Map(),
  }

  return analysis
}

export function getOrCreateImportAnalysis(
  result: TransformResult,
): ImportAnalysis {
  if (!result.analysis) {
    result.analysis = buildImportAnalysis(result)
  }

  return result.analysis
}

export function getImportSourcesFromResult(
  result: TransformResult,
): Array<string> {
  if (!mayContainImportOrExport(result.code)) {
    return []
  }

  return getOrCreateImportAnalysis(result).importSourcesInOrder
}

export function getImportSources(
  code: string,
  filename?: string,
  perf?: TransformResult['perf'],
): Array<string> {
  return getImportSourcesFromResult(makeTransientResult(code, filename, perf))
}

export function getImportSpecifierLocationFromResult(
  result: TransformResult,
  source: string,
): number {
  return (
    getOrCreateImportAnalysis(result).importSpecifierLocationIndex.get(
      source,
    ) ?? -1
  )
}

export function getMockExportNamesBySourceFromResult(
  result: TransformResult,
): Map<string, Array<string>> {
  return getOrCreateImportAnalysis(result).mockExportNamesBySource
}

export function getMockExportNamesBySource(
  code: string,
  filename?: string,
  perf?: TransformResult['perf'],
): Map<string, Array<string>> {
  return getMockExportNamesBySourceFromResult(
    makeTransientResult(code, filename, perf),
  )
}

export function getNamedExportsFromResult(
  result: TransformResult,
): Array<string> {
  return getOrCreateImportAnalysis(result).namedExports
}

export function getNamedExports(
  code: string,
  filename?: string,
  perf?: TransformResult['perf'],
): Array<string> {
  return getNamedExportsFromResult(makeTransientResult(code, filename, perf))
}

function isCompilerSafeBoundaryCall(
  call: t.CallExpression,
  fnNode: t.Function,
  envType: BoundaryEnv,
): boolean {
  const directArgument = call.arguments.some((arg) => arg === fnNode)
  if (!directArgument) {
    return false
  }

  const callee = call.callee

  if (t.isIdentifier(callee)) {
    return envType === 'client'
      ? callee.name === 'createServerOnlyFn'
      : callee.name === 'createClientOnlyFn'
  }

  if (!t.isMemberExpression(callee) || callee.computed) {
    return false
  }

  if (!t.isIdentifier(callee.property)) {
    return false
  }

  const prop = callee.property.name
  const rootName = getCalleeRootName(callee.object)

  if (envType === 'client') {
    if (prop === 'handler') {
      return rootName === 'createServerFn' || /ServerFn$/.test(rootName ?? '')
    }

    if (prop === 'server') {
      return (
        rootName === 'createMiddleware' ||
        rootName === 'createIsomorphicFn' ||
        /Middleware$/.test(rootName ?? '')
      )
    }

    return false
  }

  if (prop === 'client') {
    return rootName === 'createIsomorphicFn'
  }

  return false
}

function getCalleeRootName(
  node: t.Expression | t.Super | t.V8IntrinsicIdentifier,
): string | undefined {
  if (t.isIdentifier(node)) {
    return node.name
  }

  if (t.isCallExpression(node)) {
    return getCalleeRootName(node.callee)
  }

  if (t.isMemberExpression(node)) {
    return getCalleeRootName(node.object)
  }

  return undefined
}

function getBoundNamesFromPattern(pattern: t.LVal, out: Set<string>): void {
  if (t.isIdentifier(pattern)) {
    out.add(pattern.name)
  } else if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        getBoundNamesFromPattern(prop.argument as t.LVal, out)
      } else {
        getBoundNamesFromPattern(prop.value as t.LVal, out)
      }
    }
  } else if (t.isArrayPattern(pattern)) {
    for (const elem of pattern.elements) {
      if (elem) getBoundNamesFromPattern(elem as t.LVal, out)
    }
  } else if (t.isAssignmentPattern(pattern)) {
    getBoundNamesFromPattern(pattern.left, out)
  } else if (t.isRestElement(pattern)) {
    getBoundNamesFromPattern(pattern.argument as t.LVal, out)
  }
}

function addPatternBindingsIfTracked(
  pattern: t.LVal,
  tracked: Set<string>,
  out: Set<string>,
): void {
  const names = new Set<string>()
  getBoundNamesFromPattern(pattern, names)
  for (const name of names) {
    if (tracked.has(name)) {
      out.add(name)
    }
  }
}

function collectHoistedVarBindings(
  node: t.Node,
  tracked: Set<string>,
  out: Set<string>,
  isRoot = true,
): void {
  if (!isRoot && t.isFunction(node)) {
    return
  }

  if (t.isVariableDeclaration(node) && node.kind === 'var') {
    for (const decl of node.declarations) {
      addPatternBindingsIfTracked(decl.id as t.LVal, tracked, out)
    }
  }

  const keys = t.VISITOR_KEYS[node.type]
  if (!keys) return
  for (const key of keys) {
    const child = (node as unknown as Record<string, unknown>)[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          collectHoistedVarBindings(item as t.Node, tracked, out, false)
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      collectHoistedVarBindings(child as t.Node, tracked, out, false)
    }
  }
}

function collectProgramBindings(
  program: t.Program,
  tracked: Set<string>,
): Set<string> {
  const bindings = new Set<string>()

  for (const node of program.body) {
    if (t.isVariableDeclaration(node)) {
      for (const decl of node.declarations) {
        addPatternBindingsIfTracked(decl.id as t.LVal, tracked, bindings)
      }
      continue
    }

    if (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) {
      if (node.id && tracked.has(node.id.name)) {
        bindings.add(node.id.name)
      }
    }
  }

  return bindings
}

function collectBlockBindings(
  block: t.BlockStatement,
  tracked: Set<string>,
): Set<string> {
  const bindings = new Set<string>()

  for (const node of block.body) {
    if (t.isVariableDeclaration(node) && node.kind !== 'var') {
      for (const decl of node.declarations) {
        addPatternBindingsIfTracked(decl.id as t.LVal, tracked, bindings)
      }
      continue
    }

    if (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) {
      if (node.id && tracked.has(node.id.name)) {
        bindings.add(node.id.name)
      }
    }
  }

  return bindings
}

function collectFunctionBindings(
  fn: t.Function,
  tracked: Set<string>,
): Set<string> {
  const bindings = new Set<string>()

  if (
    (t.isFunctionDeclaration(fn) || t.isFunctionExpression(fn)) &&
    fn.id &&
    tracked.has(fn.id.name)
  ) {
    bindings.add(fn.id.name)
  }

  for (const param of fn.params) {
    addPatternBindingsIfTracked(param as t.LVal, tracked, bindings)
  }

  if (t.isBlockStatement(fn.body)) {
    collectHoistedVarBindings(fn.body, tracked, bindings)
  }

  return bindings
}

type UsageWalkContext = {
  parents: Array<t.Node>
  scopeStack: Array<Set<string>>
}

function isShadowedByScope(
  name: string,
  scopeStack: Array<Set<string>>,
): boolean {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    if (scopeStack[i]?.has(name)) {
      return true
    }
  }
  return false
}

function isBindingIdentifierInParent(
  node: t.Identifier,
  parent: t.Node | undefined,
): boolean {
  if (!parent) return false

  if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) {
    return parent.local === node
  }
  if (t.isImportNamespaceSpecifier(parent)) {
    return parent.local === node
  }
  if (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent)) {
    return (
      parent.id === node || parent.params.includes(node as unknown as t.Pattern)
    )
  }
  if (t.isArrowFunctionExpression(parent)) {
    return parent.params.includes(node as unknown as t.Pattern)
  }
  if (t.isClassDeclaration(parent) || t.isClassExpression(parent)) {
    return parent.id === node
  }
  if (t.isVariableDeclarator(parent)) {
    return parent.id === node
  }
  if (t.isCatchClause(parent)) {
    return parent.param === node
  }

  return false
}

function isInsideCompilerSafeBoundaryNodes(
  parents: Array<t.Node>,
  envType: BoundaryEnv,
): boolean {
  for (let i = parents.length - 1; i >= 0; i--) {
    const node = parents[i]!
    if (!t.isFunction(node)) {
      continue
    }

    const call = parents[i - 1]
    if (
      call &&
      t.isCallExpression(call) &&
      isCompilerSafeBoundaryCall(call, node, envType)
    ) {
      return true
    }
  }

  return false
}

function findUsagePosInAnalysis(
  result: TransformResult,
  source: string,
  envType?: BoundaryEnv,
): UsagePos | undefined {
  const analysis = getOrCreateImportAnalysis(result)
  const cacheKey: UsageCacheKey = `${envType ?? 'post'}::${source}`
  if (analysis.usageByKey.has(cacheKey)) {
    return analysis.usageByKey.get(cacheKey) ?? undefined
  }

  const imported =
    analysis.importBindingsBySource.get(source)?.importedLocalNames
  if (!imported || imported.size === 0) {
    analysis.usageByKey.set(cacheKey, null)
    return undefined
  }

  let preferred: UsagePos | undefined
  let anyUsage: UsagePos | undefined

  const visit = (node: t.Node, ctx: UsageWalkContext): void => {
    if (preferred && anyUsage) {
      return
    }

    if (t.isProgram(node)) {
      const nextCtx = {
        parents: [...ctx.parents, node],
        scopeStack: [...ctx.scopeStack, collectProgramBindings(node, imported)],
      }
      for (const child of node.body) {
        visit(child, nextCtx)
      }
      return
    }

    if (t.isFunction(node)) {
      const functionCtx = {
        parents: [...ctx.parents, node],
        scopeStack: [
          ...ctx.scopeStack,
          collectFunctionBindings(node, imported),
        ],
      }

      visit(node.body, functionCtx)
      return
    }

    if (t.isBlockStatement(node)) {
      const nextCtx = {
        parents: [...ctx.parents, node],
        scopeStack: [...ctx.scopeStack, collectBlockBindings(node, imported)],
      }
      for (const child of node.body) {
        visit(child, nextCtx)
      }
      return
    }

    if (t.isCatchClause(node)) {
      const bindings = new Set<string>()
      if (node.param) {
        addPatternBindingsIfTracked(node.param as t.LVal, imported, bindings)
      }
      const nextCtx = {
        parents: [...ctx.parents, node],
        scopeStack: bindings.size
          ? [...ctx.scopeStack, bindings]
          : ctx.scopeStack,
      }
      visit(node.body, nextCtx)
      return
    }

    if (
      t.isForStatement(node) &&
      t.isVariableDeclaration(node.init) &&
      node.init.kind !== 'var'
    ) {
      const bindings = new Set<string>()
      for (const decl of node.init.declarations) {
        addPatternBindingsIfTracked(decl.id as t.LVal, imported, bindings)
      }
      const nextCtx = {
        parents: [...ctx.parents, node],
        scopeStack: bindings.size
          ? [...ctx.scopeStack, bindings]
          : ctx.scopeStack,
      }
      visit(node.init, nextCtx)
      if (node.test) visit(node.test, nextCtx)
      if (node.update) visit(node.update, nextCtx)
      visit(node.body, nextCtx)
      return
    }

    if (
      (t.isForInStatement(node) || t.isForOfStatement(node)) &&
      t.isVariableDeclaration(node.left) &&
      node.left.kind !== 'var'
    ) {
      const bindings = new Set<string>()
      for (const decl of node.left.declarations) {
        addPatternBindingsIfTracked(decl.id as t.LVal, imported, bindings)
      }
      const nextCtx = {
        parents: [...ctx.parents, node],
        scopeStack: bindings.size
          ? [...ctx.scopeStack, bindings]
          : ctx.scopeStack,
      }
      visit(node.left, nextCtx)
      visit(node.right, nextCtx)
      visit(node.body, nextCtx)
      return
    }

    const nextParents = [...ctx.parents, node]

    if (t.isIdentifier(node)) {
      const parent = ctx.parents[ctx.parents.length - 1]
      if (imported.has(node.name)) {
        if (!isBindingIdentifierInParent(node, parent)) {
          if (
            !(
              t.isObjectProperty(parent) &&
              parent.key === node &&
              !parent.computed &&
              !parent.shorthand
            ) &&
            !(
              t.isObjectMethod(parent) &&
              parent.key === node &&
              !parent.computed
            ) &&
            !(t.isExportSpecifier(parent) && parent.exported === node) &&
            !isShadowedByScope(node.name, ctx.scopeStack) &&
            !(
              envType && isInsideCompilerSafeBoundaryNodes(ctx.parents, envType)
            )
          ) {
            const loc = node.loc?.start
            if (loc) {
              const pos: UsagePos = { line: loc.line, column0: loc.column }
              const isPreferred =
                (t.isCallExpression(parent) && parent.callee === node) ||
                (t.isNewExpression(parent) && parent.callee === node) ||
                ((t.isMemberExpression(parent) ||
                  t.isOptionalMemberExpression(parent)) &&
                  parent.object === node)

              if (isPreferred) {
                preferred ||= pos
              } else {
                anyUsage ||= pos
              }
            }
          }
        }
      }
    }

    if (t.isImportDeclaration(node)) {
      return
    }

    const keys = t.VISITOR_KEYS[node.type]
    if (!keys) return
    for (const key of keys) {
      const child = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            visit(item as t.Node, {
              parents: nextParents,
              scopeStack: ctx.scopeStack,
            })
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        visit(child as t.Node, {
          parents: nextParents,
          scopeStack: ctx.scopeStack,
        })
      }
    }
  }

  visit(analysis.ast.program, {
    parents: [],
    scopeStack: [],
  })

  const pos = preferred ?? anyUsage ?? null
  analysis.usageByKey.set(cacheKey, pos)
  return pos ?? undefined
}

export function findPostCompileUsagePosFromResult(
  result: TransformResult,
  source: string,
): UsagePos | undefined {
  return findUsagePosInAnalysis(result, source)
}

export function findPostCompileUsagePos(
  code: string,
  source: string,
): UsagePos | undefined {
  return findPostCompileUsagePosFromResult(makeTransientResult(code), source)
}

export function findOriginalUnsafeUsagePosFromResult(
  result: TransformResult,
  source: string,
  envType: BoundaryEnv,
): UsagePos | undefined {
  return findUsagePosInAnalysis(result, source, envType)
}

export function findOriginalUnsafeUsagePos(
  code: string,
  source: string,
  envType: BoundaryEnv,
): UsagePos | undefined {
  return findOriginalUnsafeUsagePosFromResult(
    makeTransientResult(code),
    source,
    envType,
  )
}
