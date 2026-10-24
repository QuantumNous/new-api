import type ts from 'typescript'

export interface AsyncComponentInfo {
  name: string
  fileName: string
  node: ts.FunctionDeclaration | ts.VariableDeclaration
  line: number
}

/**
 * Detects async function components in a TypeScript source file.
 * A component is identified by:
 * - PascalCase name (starts with uppercase)
 * - async function declaration or const assigned to async arrow/function
 */
export function createAsyncComponentDetector(tsLib: typeof ts) {
  return {
    /**
     * Find all async components in a source file
     */
    detectAsyncComponents(
      sourceFile: ts.SourceFile,
    ): Array<AsyncComponentInfo> {
      const asyncComponents: Array<AsyncComponentInfo> = []

      function visit(node: ts.Node): void {
        // async function MyComponent() { ... }
        if (
          tsLib.isFunctionDeclaration(node) &&
          node.name &&
          isPascalCase(node.name.text) &&
          hasAsyncModifier(node)
        ) {
          asyncComponents.push({
            name: node.name.text,
            fileName: sourceFile.fileName,
            node,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.getStart()).line +
              1,
          })
        }

        // const MyComponent = async () => { ... }
        // const MyComponent = async function() { ... }
        if (tsLib.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (
              tsLib.isIdentifier(decl.name) &&
              isPascalCase(decl.name.text) &&
              decl.initializer &&
              isAsyncFunctionLike(decl.initializer)
            ) {
              asyncComponents.push({
                name: decl.name.text,
                fileName: sourceFile.fileName,
                node: decl,
                line:
                  sourceFile.getLineAndCharacterOfPosition(decl.getStart())
                    .line + 1,
              })
            }
          }
        }

        tsLib.forEachChild(node, visit)
      }

      visit(sourceFile)
      return asyncComponents
    },

    /**
     * Check if a specific function node is async
     */
    isAsyncFunction(node: ts.Node): boolean {
      if (
        tsLib.isFunctionDeclaration(node) ||
        tsLib.isFunctionExpression(node)
      ) {
        return hasAsyncModifier(node)
      }
      if (tsLib.isArrowFunction(node)) {
        return hasAsyncModifier(node)
      }
      return false
    },
  }

  function isPascalCase(name: string): boolean {
    return /^[A-Z]/.test(name)
  }

  function hasAsyncModifier(
    node:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | ts.MethodDeclaration,
  ): boolean {
    return (
      node.modifiers?.some(
        (mod) => mod.kind === tsLib.SyntaxKind.AsyncKeyword,
      ) ?? false
    )
  }

  function isAsyncFunctionLike(node: ts.Node): boolean {
    if (tsLib.isArrowFunction(node)) {
      return hasAsyncModifier(node)
    }
    if (tsLib.isFunctionExpression(node)) {
      return hasAsyncModifier(node)
    }
    return false
  }
}

export type AsyncComponentDetector = ReturnType<
  typeof createAsyncComponentDetector
>
