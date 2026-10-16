import type ts from 'typescript'
import type { UseClientResolver } from '../../shared/use-client-resolver'
import type { Violation, ViolationDetector } from './violation-detector'

export interface ImportEdge {
  fromFile: string
  toFile: string
  viaSymbol: string
}

export interface TransitiveResult {
  isClientBoundary: boolean
  violations: Array<Violation & { chain: Array<ImportEdge> }>
}

export interface TransitiveAnalyzer {
  /**
   * Analyze an entry symbol and all reachable symbols for violations.
   * Stops at 'use client' boundaries.
   */
  analyzeEntrySymbol: (entrySymbol: ts.Symbol) => TransitiveResult
}

/**
 * Creates an analyzer that follows reachable symbol references
 * to find transitive violations, stopping at 'use client' boundaries.
 */
export function createTransitiveAnalyzer(
  tsLib: typeof ts,
  program: ts.Program,
  checker: ts.TypeChecker,
  useClientResolver: UseClientResolver,
  violationDetector: ViolationDetector,
): TransitiveAnalyzer {
  const visitedSymbols = new Set<string>()
  const analysisCache = new Map<string, TransitiveResult>()

  function symbolKey(symbol: ts.Symbol): string {
    const decl = symbol.getDeclarations()?.[0]
    return `${decl?.getSourceFile().fileName ?? 'unknown'}::${symbol.getName()}`
  }

  function analyzeEntrySymbol(entrySymbol: ts.Symbol): TransitiveResult {
    visitedSymbols.clear()

    const cached = analysisCache.get(symbolKey(entrySymbol))
    if (cached) return cached

    const violations: Array<Violation & { chain: Array<ImportEdge> }> = []

    function visitSymbol(symbol: ts.Symbol, chain: Array<ImportEdge>): boolean {
      const key = symbolKey(symbol)
      if (visitedSymbols.has(key)) return false
      visitedSymbols.add(key)

      const decl = symbol.getDeclarations()?.[0]
      if (!decl) return false

      const sourceFile = decl.getSourceFile()
      const fileName = sourceFile.fileName

      // Skip node_modules and declaration files
      if (fileName.includes('/node_modules/') || fileName.endsWith('.d.ts')) {
        return false
      }

      // Check for 'use client' boundary
      if (useClientResolver.hasUseClientDirective(fileName)) {
        return true // client boundary - stop here
      }

      // Find the traversal root for this symbol
      const traversalRoots = getTraversalRoots(decl)

      // Detect violations ONLY within the symbol's traversal roots, not the entire file
      for (const root of traversalRoots) {
        const rootViolations = violationDetector.detectViolationsInNode(
          root,
          sourceFile,
        )
        for (const v of rootViolations) {
          violations.push({ ...v, chain: [...chain] })
        }
      }

      // Collect reachable identifiers from traversal roots
      for (const root of traversalRoots) {
        const identifiers = collectReachableIdentifiers(root, decl)

        for (const ident of identifiers) {
          const refSym = checker.getSymbolAtLocation(ident)
          if (!refSym) continue

          // Resolve alias if needed
          const aliased =
            tsLib.SymbolFlags.Alias & refSym.flags
              ? checker.getAliasedSymbol(refSym)
              : refSym

          const refDecl = aliased.getDeclarations()?.[0]
          const refFile = refDecl?.getSourceFile().fileName
          if (!refFile) continue

          // Skip libs / node_modules
          if (refFile.includes('/node_modules/') || refFile.endsWith('.d.ts')) {
            continue
          }

          const edge: ImportEdge = {
            fromFile: fileName,
            toFile: refFile,
            viaSymbol: aliased.getName(),
          }

          visitSymbol(aliased, [...chain, edge])
        }
      }

      return false
    }

    /**
     * Get traversal roots based on declaration kind
     */
    function getTraversalRoots(decl: ts.Declaration): Array<ts.Node> {
      // FunctionDeclaration / FunctionExpression / ArrowFunction: its body
      if (tsLib.isFunctionDeclaration(decl) && decl.body) {
        return [decl.body]
      }
      if (tsLib.isFunctionExpression(decl)) {
        return [decl.body]
      }
      if (tsLib.isArrowFunction(decl)) {
        return [decl.body]
      }

      // VariableDeclaration: check initializer
      if (tsLib.isVariableDeclaration(decl) && decl.initializer) {
        if (
          tsLib.isFunctionExpression(decl.initializer) ||
          tsLib.isArrowFunction(decl.initializer)
        ) {
          return [decl.initializer.body]
        }
        return [decl.initializer]
      }

      // ClassDeclaration / ClassExpression: traverse methods + property initializers
      if (tsLib.isClassDeclaration(decl) || tsLib.isClassExpression(decl)) {
        const roots: Array<ts.Node> = []
        for (const member of decl.members) {
          if (tsLib.isMethodDeclaration(member) && member.body) {
            roots.push(member.body)
          }
          if (tsLib.isPropertyDeclaration(member) && member.initializer) {
            roots.push(member.initializer)
          }
        }
        return roots
      }

      // ExportSpecifier / ImportSpecifier: resolve aliased symbol handled by caller
      // Fallback: traverse the declaration node itself
      return [decl]
    }

    /**
     * Collect identifier nodes from a traversal root, skipping:
     * - The defining identifier for the symbol (avoid self-loop)
     * - Type-only positions
     * - Property names when not computed
     */
    function collectReachableIdentifiers(
      root: ts.Node,
      originalDecl: ts.Declaration,
    ): Array<ts.Identifier> {
      const identifiers: Array<ts.Identifier> = []

      // Get the name of the original declaration to avoid self-reference
      let declName: string | undefined
      if ('name' in originalDecl && originalDecl.name) {
        const nameNode = originalDecl.name as ts.Node
        if (tsLib.isIdentifier(nameNode)) {
          declName = nameNode.text
        }
      }

      function visit(node: ts.Node) {
        // Skip type-only positions
        if (
          tsLib.isTypeReferenceNode(node) ||
          tsLib.isInterfaceDeclaration(node) ||
          tsLib.isTypeAliasDeclaration(node) ||
          tsLib.isTypeQueryNode(node) ||
          tsLib.isTypeParameterDeclaration(node)
        ) {
          return // Don't descend into type nodes
        }

        if (tsLib.isIdentifier(node)) {
          const name = node.text

          // Skip the defining identifier
          if (name === declName) return

          // Skip property names in property access (obj.prop -> prop is not a symbol ref)
          const parent = node.parent
          if (
            tsLib.isPropertyAccessExpression(parent) &&
            parent.name === node
          ) {
            return
          }

          // Skip property names in object literals
          if (tsLib.isPropertyAssignment(parent) && parent.name === node) {
            return
          }

          // Skip parameter names and variable declaration names
          if (
            (tsLib.isParameter(parent) && parent.name === node) ||
            (tsLib.isVariableDeclaration(parent) && parent.name === node)
          ) {
            return
          }

          identifiers.push(node)
        }

        tsLib.forEachChild(node, visit)
      }

      visit(root)
      return identifiers
    }

    const isClientBoundary = visitSymbol(entrySymbol, [])
    const result: TransitiveResult = { isClientBoundary, violations }
    analysisCache.set(symbolKey(entrySymbol), result)
    return result
  }

  return { analyzeEntrySymbol }
}
