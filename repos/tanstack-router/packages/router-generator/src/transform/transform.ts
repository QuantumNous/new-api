import MagicString from 'magic-string'
import * as t from '@babel/types'
import { parseAst } from '@tanstack/router-utils'
import type { TransformOptions, TransformResult } from './types'

const routeConstructors = ['createFileRoute', 'createLazyFileRoute'] as const

type RouteConstructorName = (typeof routeConstructors)[number]
type SupportedRouteId = t.StringLiteral | t.TemplateLiteral
type NamedImport = {
  imported: string
  local: string
  importKind?: 'type' | 'typeof' | 'value'
}

type ParsedImportDeclaration = {
  declaration: t.ImportDeclaration
  defaultImport?: string
  namespace?: string
  named: Array<NamedImport>
  moduleName: string
  quote: '"' | "'"
  semicolon: boolean
}

type RouteImportAnalysis =
  | { kind: 'ok' }
  | {
      kind: 'rename'
      imported: t.Identifier
      local: t.Identifier
      next: RouteConstructorName
    }
  | { kind: 'normalize' }

type RouteCall = {
  callee: t.Identifier & { name: RouteConstructorName }
  routeIdArg: SupportedRouteId
  optionsArg: t.CallExpression['arguments'][number] | undefined
}

type RouteCallAnalysis = {
  calls: Array<RouteCall>
  hasUnsupportedRouteId: boolean
  hasMalformedRouteCall: boolean
}

export function transform({
  ctx,
  source,
  filename,
  node,
}: TransformOptions): TransformResult {
  let ast: ReturnType<typeof parseAst>

  try {
    ast = parseAst({ code: source, filename })
  } catch (error) {
    return {
      result: 'error',
      error,
    }
  }

  const exportedRouteNames = getExportedRouteNames(ast.program.body)

  if (exportedRouteNames.size === 0) {
    return { result: 'no-route-export' }
  }

  const {
    calls: routeCalls,
    hasUnsupportedRouteId,
    hasMalformedRouteCall,
  } = findExportedRouteCalls(ast.program.body, exportedRouteNames)

  if (routeCalls.length === 0 && hasMalformedRouteCall) {
    return {
      result: 'error',
      error: new Error(
        `expected Route export in ${ctx.routeId} to use createFileRoute('/path')({...}) or createLazyFileRoute('/path')({...})`,
      ),
    }
  }

  if (routeCalls.length === 0 && hasUnsupportedRouteId) {
    return {
      result: 'error',
      error: new Error(
        `expected route id to be a string literal or plain template literal in ${ctx.routeId}`,
      ),
    }
  }

  if (routeCalls.length === 0) {
    return { result: 'not-modified' }
  }

  if (routeCalls.length > 1) {
    return {
      result: 'error',
      error: new Error(
        `expected exactly one createFileRoute/createLazyFileRoute call in ${ctx.routeId}`,
      ),
    }
  }

  const routeCall = routeCalls[0]!
  const routeIdQuote = getRouteIdQuote(source, routeCall.routeIdArg)

  const createFileRouteProps = getCreateFileRouteProps(routeCall.optionsArg)
  if (createFileRouteProps) {
    node.createFileRouteProps = createFileRouteProps
  }

  const expectedCallee = getExpectedRouteConstructor(ctx.lazy)
  const expectedRouteId = `${routeIdQuote}${ctx.routeId}${routeIdQuote}`
  const currentRouteId = source.slice(
    routeCall.routeIdArg.start!,
    routeCall.routeIdArg.end!,
  )
  const targetModule = `@tanstack/${ctx.target}-router`
  const imports = parseTargetImports(ast.program.body, source, targetModule)

  const s = new MagicString(source)
  let modified = false

  if (routeCall.callee.name !== expectedCallee) {
    s.update(routeCall.callee.start!, routeCall.callee.end!, expectedCallee)
    modified = true
  }

  if (currentRouteId !== expectedRouteId) {
    s.update(
      routeCall.routeIdArg.start!,
      routeCall.routeIdArg.end!,
      expectedRouteId,
    )
    modified = true
  }

  if (
    updateRouteImports({
      imports,
      source,
      s,
      targetModule,
      required: expectedCallee,
      lineEnding: getLineEnding(source),
    })
  ) {
    modified = true
  }

  if (!modified) {
    return { result: 'not-modified' }
  }

  return {
    result: 'modified',
    output: s.toString(),
  }
}

function getExportedRouteNames(body: Array<t.Statement>) {
  const exportedRouteNames = new Set<string>()

  for (const statement of body) {
    if (!t.isExportNamedDeclaration(statement) || statement.source) {
      continue
    }

    if (t.isVariableDeclaration(statement.declaration)) {
      for (const declarator of statement.declaration.declarations) {
        if (t.isIdentifier(declarator.id) && declarator.id.name === 'Route') {
          exportedRouteNames.add('Route')
        }
      }
    }

    for (const specifier of statement.specifiers) {
      if (
        !t.isExportSpecifier(specifier) ||
        getExportedName(specifier.exported) !== 'Route'
      ) {
        continue
      }

      const localName = getLocalBindingName(specifier.local)
      if (localName) {
        exportedRouteNames.add(localName)
      }
    }
  }

  return exportedRouteNames
}

function findExportedRouteCalls(
  body: Array<t.Statement>,
  exportedRouteNames: Set<string>,
): RouteCallAnalysis {
  const calls: Array<RouteCall> = []
  let hasUnsupportedRouteId = false
  let hasMalformedRouteCall = false

  for (const statement of body) {
    const declaration = getVariableDeclaration(statement)
    if (!declaration) {
      continue
    }

    for (const declarator of declaration.declarations) {
      if (
        !t.isIdentifier(declarator.id) ||
        !exportedRouteNames.has(declarator.id.name)
      ) {
        continue
      }

      const init = getRouteConstructorInit(declarator.init)
      if (!init) {
        if (isDirectRouteConstructorCall(declarator.init)) {
          hasMalformedRouteCall = true
        }
        continue
      }

      const routeIdArg = init.innerCall.arguments[0]
      if (isSupportedRouteId(routeIdArg)) {
        calls.push({
          callee: init.callee,
          routeIdArg,
          optionsArg: init.outerCall.arguments[0],
        })
      } else {
        hasUnsupportedRouteId = true
      }
    }
  }

  return { calls, hasUnsupportedRouteId, hasMalformedRouteCall }
}

function getVariableDeclaration(statement: t.Statement) {
  const declaration = t.isExportNamedDeclaration(statement)
    ? statement.declaration
    : statement

  return t.isVariableDeclaration(declaration) ? declaration : null
}

function getExportedName(node: t.Identifier | t.StringLiteral) {
  return t.isIdentifier(node) ? node.name : node.value
}

function getLocalBindingName(node: t.Identifier | t.StringLiteral) {
  return t.isIdentifier(node) ? node.name : null
}

function getRouteConstructorInit(expression: t.Expression | null | undefined) {
  if (!expression || !t.isCallExpression(expression)) {
    return null
  }

  if (!t.isCallExpression(expression.callee)) {
    return null
  }

  const innerCall = expression.callee

  if (
    !t.isIdentifier(innerCall.callee) ||
    !isRouteConstructor(innerCall.callee)
  ) {
    return null
  }

  return {
    callee: innerCall.callee,
    outerCall: expression,
    innerCall,
  }
}

function isDirectRouteConstructorCall(
  expression: t.Expression | null | undefined,
) {
  return (
    !!expression &&
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    isRouteConstructor(expression.callee)
  )
}

function isRouteConstructor(callee: t.Identifier): callee is t.Identifier & {
  name: RouteConstructorName
} {
  return routeConstructors.includes(callee.name as RouteConstructorName)
}

function isSupportedRouteId(
  arg: t.CallExpression['arguments'][number] | undefined,
): arg is SupportedRouteId {
  return (
    !!arg &&
    (t.isStringLiteral(arg) ||
      (t.isTemplateLiteral(arg) && arg.expressions.length === 0))
  )
}

function getRouteIdQuote(
  source: string,
  arg: SupportedRouteId,
): '"' | "'" | '`' {
  const raw = source.slice(arg.start!, arg.end!)

  if (raw.startsWith("'")) return "'"
  if (raw.startsWith('"')) return '"'
  return '`'
}

function getCreateFileRouteProps(
  arg: t.CallExpression['arguments'][number] | undefined,
) {
  if (!arg || !t.isObjectExpression(arg)) {
    return undefined
  }

  const props = new Set<string>()

  for (const property of arg.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue
    }

    if (t.isIdentifier(property.key)) {
      props.add(property.key.name)
      continue
    }

    if (t.isStringLiteral(property.key)) {
      props.add(property.key.value)
    }
  }

  return props
}

function parseTargetImports(
  body: Array<t.Statement>,
  source: string,
  targetModule: string,
) {
  const imports: Array<ParsedImportDeclaration> = []

  for (const statement of body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.importKind === 'type' ||
      statement.source.value !== targetModule
    ) {
      continue
    }

    const rawSource = source.slice(
      statement.source.start!,
      statement.source.end!,
    )
    const importStatement = source.slice(statement.start!, statement.end!)

    imports.push({
      declaration: statement,
      defaultImport: statement.specifiers.find((specifier) =>
        t.isImportDefaultSpecifier(specifier),
      )?.local.name,
      namespace: statement.specifiers.find((specifier) =>
        t.isImportNamespaceSpecifier(specifier),
      )?.local.name,
      named: statement.specifiers
        .filter((specifier): specifier is t.ImportSpecifier =>
          t.isImportSpecifier(specifier),
        )
        .map((specifier) => ({
          imported: t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value,
          local: specifier.local.name,
          importKind: specifier.importKind ?? undefined,
        })),
      moduleName: statement.source.value,
      quote: rawSource[0] as '"' | "'",
      semicolon: importStatement.trimEnd().endsWith(';'),
    })
  }

  return imports
}

function updateRouteImports({
  imports,
  source,
  s,
  targetModule,
  required,
  lineEnding,
}: {
  imports: Array<ParsedImportDeclaration>
  source: string
  s: MagicString
  targetModule: string
  required: RouteConstructorName
  lineEnding: '\r\n' | '\n' | '\r'
}) {
  const analysis = analyzeRouteImports(imports, required)

  if (analysis.kind === 'ok') {
    return false
  }

  if (analysis.kind === 'rename') {
    s.update(analysis.imported.start!, analysis.imported.end!, analysis.next)
    s.update(analysis.local.start!, analysis.local.end!, analysis.next)
    return true
  }

  return normalizeRouteImports({
    imports,
    source,
    s,
    targetModule,
    required,
    lineEnding,
  })
}

function analyzeRouteImports(
  imports: Array<ParsedImportDeclaration>,
  required: RouteConstructorName,
): RouteImportAnalysis {
  const opposite = getOtherRouteConstructor(required)
  let requiredCount = 0
  let oppositeCount = 0
  let renameCandidate:
    | {
        imported: t.Identifier
        local: t.Identifier
        next: RouteConstructorName
      }
    | undefined

  for (const declaration of imports) {
    for (const specifier of declaration.declaration.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        continue
      }

      const imported = specifier.imported
      if (!t.isIdentifier(imported)) {
        return { kind: 'normalize' }
      }

      if (!isRouteConstructorName(imported.name)) {
        continue
      }

      if (specifier.local.name !== imported.name) {
        return { kind: 'normalize' }
      }

      if (imported.name === required) {
        requiredCount++
        continue
      }

      if (imported.name === opposite) {
        oppositeCount++
        renameCandidate = {
          imported,
          local: specifier.local,
          next: required,
        }
      }
    }
  }

  if (requiredCount === 1 && oppositeCount === 0) {
    return { kind: 'ok' }
  }

  if (requiredCount === 0 && oppositeCount === 1 && renameCandidate) {
    return {
      kind: 'rename',
      ...renameCandidate,
    }
  }

  return { kind: 'normalize' }
}

function normalizeRouteImports({
  imports,
  source,
  s,
  targetModule,
  required,
  lineEnding,
}: {
  imports: Array<ParsedImportDeclaration>
  source: string
  s: MagicString
  targetModule: string
  required: RouteConstructorName
  lineEnding: '\r\n' | '\n' | '\r'
}) {
  const owner =
    imports.find((declaration) =>
      hasNamedImport(declaration.named, required),
    ) ?? imports.find((declaration) => !declaration.namespace)

  let modified = false

  for (const declaration of imports) {
    const named = normalizeNamedImports({
      named: declaration.named,
      required,
      isOwner: declaration === owner,
    })

    if (sameNamedImports(declaration.named, named)) {
      continue
    }

    const replacement = renderImportDeclaration({
      ...declaration,
      named,
    })

    if (replacement === null) {
      s.remove(
        declaration.declaration.start!,
        getRemovalEnd(source, declaration.declaration.end!),
      )
      modified = true
      continue
    }

    s.update(
      declaration.declaration.start!,
      declaration.declaration.end!,
      replacement,
    )
    modified = true
  }

  if (!owner) {
    const quote = imports[0]?.quote ?? "'"
    const semicolon = imports[0]?.semicolon ?? false
    s.prepend(
      `import { ${required} } from ${quote}${targetModule}${quote}${semicolon ? ';' : ''}${lineEnding}`,
    )
    modified = true
  }

  return modified
}

function normalizeNamedImports({
  named,
  required,
  isOwner,
}: {
  named: Array<NamedImport>
  required: RouteConstructorName
  isOwner: boolean
}) {
  const banned = getOtherRouteConstructor(required)
  const nextNamed: Array<NamedImport> = []
  const seen = new Set<string>()

  for (const specifier of named) {
    if (specifier.imported === banned) {
      continue
    }

    if (
      specifier.local === required &&
      (specifier.imported !== required || !isOwner)
    ) {
      continue
    }

    const key = `${specifier.importKind ?? 'value'}:${specifier.imported}:${specifier.local}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    nextNamed.push(specifier)
  }

  if (isOwner && !hasNamedImport(nextNamed, required)) {
    nextNamed.push({ imported: required, local: required })
  }

  return nextNamed
}

function getExpectedRouteConstructor(lazy: boolean): RouteConstructorName {
  return lazy ? 'createLazyFileRoute' : 'createFileRoute'
}

function getOtherRouteConstructor(
  constructor: RouteConstructorName,
): RouteConstructorName {
  return constructor === 'createFileRoute'
    ? 'createLazyFileRoute'
    : 'createFileRoute'
}

function hasNamedImport(
  named: Array<NamedImport>,
  required: RouteConstructorName,
) {
  return named.some(
    (specifier) =>
      specifier.imported === required &&
      specifier.local === required &&
      specifier.importKind !== 'type',
  )
}

function sameNamedImports(left: Array<NamedImport>, right: Array<NamedImport>) {
  return (
    left.length === right.length &&
    left.every(
      (specifier, index) =>
        specifier.imported === right[index]!.imported &&
        specifier.local === right[index]!.local &&
        specifier.importKind === right[index]!.importKind,
    )
  )
}

function isRouteConstructorName(value: string): value is RouteConstructorName {
  return routeConstructors.includes(value as RouteConstructorName)
}

function renderImportDeclaration(importDeclaration: {
  defaultImport?: string
  namespace?: string
  named: Array<NamedImport>
  moduleName: string
  quote: '"' | "'"
  semicolon: boolean
}) {
  const parts: Array<string> = []

  if (importDeclaration.defaultImport) {
    parts.push(importDeclaration.defaultImport)
  }

  if (importDeclaration.namespace) {
    parts.push(`* as ${importDeclaration.namespace}`)
  }

  if (importDeclaration.named.length > 0) {
    parts.push(
      `{ ${importDeclaration.named
        .map(
          (specifier) =>
            `${specifier.importKind === 'type' ? 'type ' : ''}${specifier.imported === specifier.local ? specifier.imported : `${specifier.imported} as ${specifier.local}`}`,
        )
        .join(', ')} }`,
    )
  }

  if (parts.length === 0) {
    return null
  }

  return `import ${parts.join(', ')} from ${importDeclaration.quote}${importDeclaration.moduleName}${importDeclaration.quote}${importDeclaration.semicolon ? ';' : ''}`
}

function getLineEnding(source: string): '\r\n' | '\n' | '\r' {
  if (source.includes('\r\n')) {
    return '\r\n'
  }

  if (source.includes('\n')) {
    return '\n'
  }

  if (source.includes('\r')) {
    return '\r'
  }

  return '\n'
}

function getRemovalEnd(source: string, end: number) {
  let pos = end
  while (pos < source.length && (source[pos] === ' ' || source[pos] === '\t')) {
    pos++
  }

  if (source[pos] === '\r' && source[pos + 1] === '\n') {
    return pos + 2
  }

  if (source[pos] === '\n' || source[pos] === '\r') {
    return pos + 1
  }

  return end
}
