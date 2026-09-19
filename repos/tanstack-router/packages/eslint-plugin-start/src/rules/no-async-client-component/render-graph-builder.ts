import {
  ROUTE_COMPONENT_OPTION_NAMES,
  ROUTE_CREATOR_NAMES,
  SERVER_COMPONENT_ROOTS,
} from './constants'
import type ts from 'typescript'

export interface ComponentInfo {
  name: string
  fileName: string
  node: ts.Node
  isAsync: boolean
  line: number
}

export interface RenderEdge {
  fromFile: string
  fromComponent: string
  toFile: string
  toComponent: string
  toComponentKey: string
  jsxNode: ts.Node
  jsxLine: number
}

export interface RouteOptionUsage {
  componentKey: string
  usageNode: ts.Node
  usageLine: number
  fileName: string
}

export interface RenderGraph {
  /** Map of "fileName:ComponentName" -> ComponentInfo */
  components: Map<string, ComponentInfo>
  /** All render edges (component -> component via JSX) */
  edges: Array<RenderEdge>
  /** Components under server-component roots */
  serverRoots: Set<string>
  /** Components referenced by route options or in 'use client' files */
  clientRoots: Set<string>
  /** Files with 'use client' directive */
  useClientFiles: Set<string>
  /** Route option usage info for better error locations */
  routeOptionUsages: Map<string, RouteOptionUsage>
  /** Index: file name -> component keys referenced by route options in that file */
  routeOptionRootsByFile: Map<string, Set<string>>
}

/**
 * Builds a render graph from the TypeScript program.
 * Indexes components, JSX edges, server roots, and client roots.
 */
export function createRenderGraphBuilder(
  tsLib: typeof ts,
  program: ts.Program,
  checker: ts.TypeChecker,
) {
  const graph: RenderGraph = {
    components: new Map(),
    edges: [],
    serverRoots: new Set(),
    clientRoots: new Set(),
    useClientFiles: new Set(),
    routeOptionUsages: new Map(),
    routeOptionRootsByFile: new Map(),
  }

  return {
    build(): RenderGraph {
      for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue
        if (sourceFile.fileName.includes('node_modules')) continue

        // Pre-filter: skip files that can't contribute to the render graph
        if (!fileCanContribute(sourceFile)) continue

        processSourceFile(sourceFile)
      }
      return graph
    },

    getGraph(): RenderGraph {
      return graph
    },
  }

  /**
   * Quick text-based check to skip files that can't contribute edges or roots.
   * A file can contribute if it might have:
   * - JSX (components, edges)
   * - 'use client' directive (client roots)
   * - createFileRoute/createRootRoute (route-option roots)
    * - renderServerComponent/createCompositeComponent (server roots)

   */
  function fileCanContribute(sourceFile: ts.SourceFile): boolean {
    const text = sourceFile.text

    // Quick check: has JSX-like syntax or relevant keywords
    // Must handle both <Tag /> and <Tag></Tag>
    const hasJsx =
      text.includes('<') && (text.includes('/>') || text.includes('</'))
    const hasUseClient = text.includes('use client')
    const hasRouteCreator =
      text.includes('createFileRoute') ||
      text.includes('createRootRoute') ||
      text.includes('createRootRouteWithContext')
    const hasServerComponentRoot = SERVER_COMPONENT_ROOTS.some((name) =>
      text.includes(name),
    )

    return hasJsx || hasUseClient || hasRouteCreator || hasServerComponentRoot
  }

  function processSourceFile(sourceFile: ts.SourceFile): void {
    // Check for 'use client' directive
    if (hasUseClientDirective(sourceFile)) {
      graph.useClientFiles.add(sourceFile.fileName)
    }

    // Walk AST
    visitNode(sourceFile, sourceFile, null)
  }

  function hasUseClientDirective(sourceFile: ts.SourceFile): boolean {
    const firstStatement = sourceFile.statements[0]
    if (!firstStatement) return false

    if (
      tsLib.isExpressionStatement(firstStatement) &&
      tsLib.isStringLiteral(firstStatement.expression) &&
      firstStatement.expression.text === 'use client'
    ) {
      return true
    }
    return false
  }

  function visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    currentComponent: string | null,
  ): void {
    // Index component definitions
    if (tsLib.isFunctionDeclaration(node) && node.name) {
      if (isPascalCase(node.name.text)) {
        const key = makeKey(sourceFile.fileName, node.name.text)
        graph.components.set(key, {
          name: node.name.text,
          fileName: sourceFile.fileName,
          node,
          isAsync: hasAsyncModifier(node),
          line: getLine(sourceFile, node),
        })

        // If file has 'use client', mark as client root
        if (graph.useClientFiles.has(sourceFile.fileName)) {
          graph.clientRoots.add(key)
        }

        // Visit body with this component as context
        if (node.body) {
          tsLib.forEachChild(node.body, (child) =>
            visitNode(child, sourceFile, key),
          )
        }
        return
      }
    }

    // const MyComponent = () => { ... } or const MyComponent = function() { ... }
    if (tsLib.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          tsLib.isIdentifier(decl.name) &&
          isPascalCase(decl.name.text) &&
          decl.initializer &&
          isFunctionLike(decl.initializer)
        ) {
          const key = makeKey(sourceFile.fileName, decl.name.text)
          graph.components.set(key, {
            name: decl.name.text,
            fileName: sourceFile.fileName,
            node: decl,
            isAsync: isAsyncFunctionLike(decl.initializer),
            line: getLine(sourceFile, decl),
          })

          if (graph.useClientFiles.has(sourceFile.fileName)) {
            graph.clientRoots.add(key)
          }

          // Visit body with this component as context
          const funcNode = decl.initializer as
            | ts.ArrowFunction
            | ts.FunctionExpression
          tsLib.forEachChild(funcNode.body, (child) =>
            visitNode(child, sourceFile, key),
          )
        } else if (decl.initializer) {
          // For non-component variable declarations (like route definitions),
          // visit the initializer to detect route creator calls
          visitNode(decl.initializer, sourceFile, currentComponent)
        }
      }
      return
    }

    // Detect server-component roots
    // - createCompositeComponent((props) => <...>)
    // - renderServerComponent(<...>)
    if (tsLib.isCallExpression(node)) {
      const serverRootKind = getServerRootKind(node, checker)
      if (serverRootKind === 'createCompositeComponent') {
        const callback = node.arguments[0]
        if (callback && isFunctionLike(callback)) {
          collectJsxComponentRefs(callback, sourceFile, currentComponent, true)
        }
        return
      }

      if (serverRootKind === 'renderServerComponent') {
        const element = node.arguments[0]
        if (element) {
          collectJsxComponentRefs(element, sourceFile, currentComponent, true)
        }
        return
      }
    }

    // Detect createFileRoute/createRootRoute/createRootRouteWithContext()({ component: X })
    if (tsLib.isCallExpression(node)) {
      const routeOptions = getRouteOptionsObject(node)
      if (routeOptions) {
        for (const prop of routeOptions.properties) {
          if (
            tsLib.isPropertyAssignment(prop) &&
            tsLib.isIdentifier(prop.name) &&
            ROUTE_COMPONENT_OPTION_NAMES.includes(
              prop.name.text as (typeof ROUTE_COMPONENT_OPTION_NAMES)[number],
            )
          ) {
            markAsClientRoot(
              prop.initializer,
              sourceFile,
              currentComponent,
              prop,
            )
          }
        }
      }
    }

    // Detect JSX usage: <Component />
    if (
      tsLib.isJsxOpeningElement(node) ||
      tsLib.isJsxSelfClosingElement(node)
    ) {
      const tagName = node.tagName
      if (tsLib.isIdentifier(tagName) && isPascalCase(tagName.text)) {
        // Try to resolve the component
        const symbol = checker.getSymbolAtLocation(tagName)
        if (symbol) {
          const resolved = resolveSymbol(symbol)
          if (resolved) {
            const decls = resolved.getDeclarations()
            if (decls && decls.length > 0) {
              const declFile = decls[0]!.getSourceFile().fileName
              const toKey = makeKey(declFile, tagName.text)

              if (currentComponent) {
                graph.edges.push({
                  fromFile: sourceFile.fileName,
                  fromComponent: currentComponent.split(':')[1]!,
                  toFile: declFile,
                  toComponent: tagName.text,
                  toComponentKey: toKey,
                  jsxNode: node,
                  jsxLine: getLine(sourceFile, node),
                })
              }
            }
          }
        }
      }
    }

    tsLib.forEachChild(node, (child) =>
      visitNode(child, sourceFile, currentComponent),
    )
    return
  }

  function getServerRootKind(
    node: ts.CallExpression,
    _checker: ts.TypeChecker,
  ): (typeof SERVER_COMPONENT_ROOTS)[number] | null {
    if (tsLib.isIdentifier(node.expression)) {
      const name = node.expression.text
      return SERVER_COMPONENT_ROOTS.includes(
        name as (typeof SERVER_COMPONENT_ROOTS)[number],
      )
        ? (name as (typeof SERVER_COMPONENT_ROOTS)[number])
        : null
    }

    if (
      tsLib.isPropertyAccessExpression(node.expression) &&
      tsLib.isIdentifier(node.expression.name)
    ) {
      const name = node.expression.name.text
      return SERVER_COMPONENT_ROOTS.includes(
        name as (typeof SERVER_COMPONENT_ROOTS)[number],
      )
        ? (name as (typeof SERVER_COMPONENT_ROOTS)[number])
        : null
    }

    return null
  }

  function getRouteOptionsObject(
    node: ts.CallExpression,
  ): ts.ObjectLiteralExpression | undefined {
    // Matches route options call patterns:
    // - createFileRoute('/x')({ ... })
    // - createRootRoute()({ ... })
    // - createRootRouteWithContext<T>()({ ... })
    // - plus common chaining/currying where the creator call is nested

    // We only care about the call expression that receives the options object.
    const optionsArg = node.arguments[0]
    if (!optionsArg || !tsLib.isObjectLiteralExpression(optionsArg)) {
      return
    }

    // Accept any call where the callee ultimately originates from a route creator.
    // Examples:
    //   createFileRoute('/x')({})
    //   createFileRoute('/x').update({})(...)
    //   (createFileRoute('/x'))({})
    const routeCreator = findRouteCreatorFromCallee(node.expression)
    if (!routeCreator) return

    const routeCreatorName = tsLib.isIdentifier(routeCreator)
      ? routeCreator.text
      : routeCreator.name.text

    if (
      ROUTE_CREATOR_NAMES.includes(
        routeCreatorName as (typeof ROUTE_CREATOR_NAMES)[number],
      )
    ) {
      return optionsArg
    }

    return
  }

  function findRouteCreatorFromCallee(
    expr: ts.Expression,
  ): ts.Identifier | ts.PropertyAccessExpression | undefined {
    // OUTER call has callee like: CallExpression or PropertyAccessExpression, etc.
    // Walk back through call/property/paren nodes to find the originating identifier.

    if (tsLib.isParenthesizedExpression(expr)) {
      return findRouteCreatorFromCallee(expr.expression)
    }

    if (tsLib.isCallExpression(expr)) {
      return findRouteCreatorFromCallee(expr.expression)
    }

    if (tsLib.isPropertyAccessExpression(expr)) {
      // foo.bar -> keep walking left side, but allow final `.createFileRoute` access.
      if (tsLib.isIdentifier(expr.name)) {
        if (
          ROUTE_CREATOR_NAMES.includes(
            expr.name.text as (typeof ROUTE_CREATOR_NAMES)[number],
          )
        ) {
          return expr
        }
      }
      return findRouteCreatorFromCallee(expr.expression)
    }

    if (tsLib.isIdentifier(expr)) {
      return expr
    }

    return
  }

  function markAsClientRoot(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    _currentComponent: string | null,
    usageNode?: ts.Node,
  ): void {
    // Direct identifier reference: component: MyComponent
    if (tsLib.isIdentifier(node)) {
      const componentName = node.text

      // First, try to find by symbol resolution
      const symbol = checker.getSymbolAtLocation(node)
      if (symbol) {
        const resolved = resolveSymbol(symbol)
        if (resolved) {
          const decls = resolved.getDeclarations()
          if (decls && decls.length > 0) {
            const declFile = decls[0]!.getSourceFile().fileName
            const key = makeKey(declFile, componentName)
            graph.clientRoots.add(key)
            if (usageNode) {
              graph.routeOptionUsages.set(key, {
                componentKey: key,
                usageNode,
                usageLine: getLine(sourceFile, usageNode),
                fileName: sourceFile.fileName,
              })
              addToRouteOptionRootsByFile(sourceFile.fileName, key)
            }
            return
          }
        }
      }

      // Fallback: assume it's in the same file
      const fallbackKey = makeKey(sourceFile.fileName, componentName)
      graph.clientRoots.add(fallbackKey)
      if (usageNode) {
        graph.routeOptionUsages.set(fallbackKey, {
          componentKey: fallbackKey,
          usageNode,
          usageLine: getLine(sourceFile, usageNode),
          fileName: sourceFile.fileName,
        })
        addToRouteOptionRootsByFile(sourceFile.fileName, fallbackKey)
      }
      return
    }

    // Inline function: component: () => <Foo />
    // Find JSX refs within and mark them as client roots
    if (isFunctionLike(node)) {
      collectJsxComponentRefs(node, sourceFile, null, false, usageNode)
    }
  }

  function collectJsxComponentRefs(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    _currentComponent: string | null,
    isServerContext: boolean,
    usageNode?: ts.Node,
  ): void {
    function walk(n: ts.Node): void {
      if (tsLib.isJsxOpeningElement(n) || tsLib.isJsxSelfClosingElement(n)) {
        const tagName = n.tagName
        if (tsLib.isIdentifier(tagName) && isPascalCase(tagName.text)) {
          const symbol = checker.getSymbolAtLocation(tagName)
          if (symbol) {
            const resolved = resolveSymbol(symbol)
            if (resolved) {
              const decls = resolved.getDeclarations()
              if (decls && decls.length > 0) {
                const declFile = decls[0]!.getSourceFile().fileName
                const key = makeKey(declFile, tagName.text)

                if (isServerContext) {
                  graph.serverRoots.add(key)
                } else {
                  graph.clientRoots.add(key)
                  // For inline route options like component: () => <Foo />,
                  // use the JSX node as the usage location
                  const effectiveUsageNode = usageNode ?? n
                  graph.routeOptionUsages.set(key, {
                    componentKey: key,
                    usageNode: effectiveUsageNode,
                    usageLine: getLine(sourceFile, effectiveUsageNode),
                    fileName: sourceFile.fileName,
                  })
                  addToRouteOptionRootsByFile(sourceFile.fileName, key)
                }
              }
            }
          }
        }
      }
      tsLib.forEachChild(n, walk)
    }
    walk(node)
  }

  function resolveSymbol(symbol: ts.Symbol): ts.Symbol | undefined {
    if (symbol.flags & tsLib.SymbolFlags.Alias) {
      return checker.getAliasedSymbol(symbol)
    }
    return symbol
  }

  function isPascalCase(name: string): boolean {
    return /^[A-Z]/.test(name)
  }

  function hasAsyncModifier(
    node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
  ): boolean {
    return (
      node.modifiers?.some(
        (mod) => mod.kind === tsLib.SyntaxKind.AsyncKeyword,
      ) ?? false
    )
  }

  function isFunctionLike(node: ts.Node): boolean {
    return (
      tsLib.isArrowFunction(node) ||
      tsLib.isFunctionExpression(node) ||
      tsLib.isFunctionDeclaration(node)
    )
  }

  function isAsyncFunctionLike(node: ts.Node): boolean {
    if (tsLib.isArrowFunction(node) || tsLib.isFunctionExpression(node)) {
      return hasAsyncModifier(node)
    }
    return false
  }

  function makeKey(fileName: string, componentName: string): string {
    return `${fileName}:${componentName}`
  }

  function getLine(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
  }

  function addToRouteOptionRootsByFile(fileName: string, key: string): void {
    let set = graph.routeOptionRootsByFile.get(fileName)
    if (!set) {
      set = new Set()
      graph.routeOptionRootsByFile.set(fileName, set)
    }
    set.add(key)
  }
}

export type RenderGraphBuilder = ReturnType<typeof createRenderGraphBuilder>
