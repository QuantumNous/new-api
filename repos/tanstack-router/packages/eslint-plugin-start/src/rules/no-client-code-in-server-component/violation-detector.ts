import {
  BROWSER_ONLY_GLOBALS,
  DEFAULT_ALLOWED_HOOKS,
  isClientOnlyHook,
  isReactEventHandler,
} from './constants'
import type ts from 'typescript'

export type ViolationType =
  | 'hook'
  | 'browser-global'
  | 'event-handler'
  | 'function-prop'
  | 'class-component'

export interface Violation {
  type: ViolationType
  name: string
  node: ts.Node
  fileName: string
  line: number
  column: number
}

export interface ViolationDetectorOptions {
  allowedHooks?: Set<string>
  checker?: ts.TypeChecker
}

export interface ViolationDetector {
  /**
   * Detect client-only code violations in a source file
   */
  detectViolations: (sourceFile: ts.SourceFile) => Array<Violation>

  /**
   * Detect client-only code violations within a specific node subtree
   */
  detectViolationsInNode: (
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ) => Array<Violation>
}

/**
 * Get line and column position for a node
 */
function getPosition(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(),
  )
  return { line: line + 1, column: character + 1 }
}

/**
 * Creates a detector that finds client-only code violations in TypeScript AST
 */
export function createViolationDetector(
  tsLib: typeof ts,
  options: ViolationDetectorOptions = {},
): ViolationDetector {
  const allowedHooks = options.allowedHooks ?? DEFAULT_ALLOWED_HOOKS
  const checker = options.checker

  /**
   * Check if a class declaration extends React.Component or React.PureComponent
   */
  function isReactClassComponent(node: ts.ClassDeclaration): boolean {
    if (!node.heritageClauses) return false

    for (const clause of node.heritageClauses) {
      if (clause.token !== tsLib.SyntaxKind.ExtendsKeyword) continue

      for (const type of clause.types) {
        const expr = type.expression

        // Check for React.Component or React.PureComponent
        if (tsLib.isPropertyAccessExpression(expr)) {
          const propName = expr.name.text
          if (propName === 'Component' || propName === 'PureComponent') {
            // Check if it's React.Component
            if (tsLib.isIdentifier(expr.expression)) {
              const objName = expr.expression.text
              if (objName === 'React') {
                return true
              }
            }
          }
        }

        // Check for direct Component or PureComponent import
        if (tsLib.isIdentifier(expr)) {
          const name = expr.text
          if (name === 'Component' || name === 'PureComponent') {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Shared visitor logic that collects violations into the provided array
   */
  function visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    violations: Array<Violation>,
  ) {
    // 1. Detect React class components
    if (tsLib.isClassDeclaration(node) && isReactClassComponent(node)) {
      const name = node.name?.text ?? 'ClassComponent'
      violations.push({
        type: 'class-component',
        name,
        node,
        fileName: sourceFile.fileName,
        ...getPosition(node, sourceFile),
      })
    }

    // 2. Detect hook calls: useXxx()
    if (tsLib.isCallExpression(node)) {
      const callee = node.expression
      let name = ''

      if (tsLib.isIdentifier(callee)) {
        name = callee.text
      } else if (tsLib.isPropertyAccessExpression(callee)) {
        // React.useState() etc
        name = callee.name.text
      }

      if (name && isClientOnlyHook(name, allowedHooks)) {
        violations.push({
          type: 'hook',
          name,
          node,
          fileName: sourceFile.fileName,
          ...getPosition(node, sourceFile),
        })
      }
    }

    // 3. Detect browser globals: window, document, etc.
    if (tsLib.isIdentifier(node)) {
      const name = node.text
      if (BROWSER_ONLY_GLOBALS.has(name)) {
        const parent = node.parent

        // Skip if this is the property name in a property access (obj.window is fine)
        if (tsLib.isPropertyAccessExpression(parent) && parent.name === node) {
          // This is a property access like obj.window - skip
        }
        // Skip if this is a property assignment key
        else if (tsLib.isPropertyAssignment(parent) && parent.name === node) {
          // This is { window: value } - skip
        }
        // Skip type-only positions
        else if (
          tsLib.isTypeReferenceNode(parent) ||
          tsLib.isInterfaceDeclaration(parent) ||
          tsLib.isTypeAliasDeclaration(parent)
        ) {
          // Type position - skip
        }
        // Skip if this is a parameter name or variable declaration name
        else if (
          (tsLib.isParameter(parent) && parent.name === node) ||
          (tsLib.isVariableDeclaration(parent) && parent.name === node)
        ) {
          // Declaration name - skip
        }
        // Skip if imported (the import itself is fine, usage is caught elsewhere)
        else if (
          tsLib.isImportSpecifier(parent) ||
          tsLib.isImportClause(parent)
        ) {
          // Import - skip
        }
        // If we have a type checker, verify this is truly a global reference (no local binding)
        else if (checker) {
          const symbol = checker.getSymbolAtLocation(node)
          if (symbol) {
            const declarations = symbol.getDeclarations()
            if (declarations?.length) {
              // Check if ALL declarations are from lib files (global types)
              // If any declaration is from a user file, it's a local variable
              const isLocalDeclaration = declarations.some((decl) => {
                const fileName = decl.getSourceFile().fileName
                // User declarations are not from node_modules or lib files
                return (
                  !fileName.includes('/node_modules/') &&
                  !fileName.includes('/typescript/lib/')
                )
              })

              if (isLocalDeclaration) {
                // Has a local declaration - skip
              } else {
                // All declarations are from lib files - it's a global reference
                violations.push({
                  type: 'browser-global',
                  name,
                  node,
                  fileName: sourceFile.fileName,
                  ...getPosition(node, sourceFile),
                })
              }
            } else {
              // No declarations found - treat as global
              violations.push({
                type: 'browser-global',
                name,
                node,
                fileName: sourceFile.fileName,
                ...getPosition(node, sourceFile),
              })
            }
          } else {
            // No symbol - assume global (conservative)
            violations.push({
              type: 'browser-global',
              name,
              node,
              fileName: sourceFile.fileName,
              ...getPosition(node, sourceFile),
            })
          }
        }
        // No type checker, fallback to AST-only check (may have false positives)
        else {
          violations.push({
            type: 'browser-global',
            name,
            node,
            fileName: sourceFile.fileName,
            ...getPosition(node, sourceFile),
          })
        }
      }
    }

    // 4. Detect JSX attributes: event handlers AND function props
    if (tsLib.isJsxAttribute(node)) {
      const attrName = node.name
      if (tsLib.isIdentifier(attrName)) {
        const name = attrName.text
        const value = node.initializer

        // Check if it's a React event handler (onClick, onChange, etc.)
        if (isReactEventHandler(name)) {
          violations.push({
            type: 'event-handler',
            name,
            node,
            fileName: sourceFile.fileName,
            ...getPosition(node, sourceFile),
          })
        }
        // Check if it's a function prop (not an event handler, not style/className)
        // Skip common non-function props that might have complex expressions
        else if (
          name !== 'style' &&
          name !== 'className' &&
          name !== 'key' &&
          name !== 'ref' &&
          name !== 'dangerouslySetInnerHTML' &&
          value &&
          tsLib.isJsxExpression(value) &&
          value.expression
        ) {
          const expr = value.expression
          // Only flag actual function expressions, not objects or other values
          if (tsLib.isArrowFunction(expr) || tsLib.isFunctionExpression(expr)) {
            violations.push({
              type: 'function-prop',
              name,
              node,
              fileName: sourceFile.fileName,
              ...getPosition(node, sourceFile),
            })
          }
        }
      }
    }

    tsLib.forEachChild(node, (child) =>
      visitNode(child, sourceFile, violations),
    )
  }

  function detectViolations(sourceFile: ts.SourceFile): Array<Violation> {
    const violations: Array<Violation> = []
    tsLib.forEachChild(sourceFile, (child) =>
      visitNode(child, sourceFile, violations),
    )
    return violations
  }

  function detectViolationsInNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ): Array<Violation> {
    const violations: Array<Violation> = []
    visitNode(node, sourceFile, violations)
    return violations
  }

  return { detectViolations, detectViolationsInNode }
}
