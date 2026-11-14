import * as ts from 'typescript'

export interface UseClientResolver {
  /**
   * Check if a file has 'use client' directive at the top
   */
  hasUseClientDirective: (fileName: string) => boolean
}

/**
 * Creates a resolver that checks for 'use client' directive in source files
 */
export function createUseClientResolver(
  program: ts.Program,
): UseClientResolver {
  function hasUseClientDirective(fileName: string): boolean {
    const sourceFile = program.getSourceFile(fileName)
    if (!sourceFile) return false

    const firstStmt = sourceFile.statements[0]
    if (!firstStmt) return false

    if (
      ts.isExpressionStatement(firstStmt) &&
      ts.isStringLiteral(firstStmt.expression)
    ) {
      return firstStmt.expression.text === 'use client'
    }

    return false
  }

  return { hasUseClientDirective }
}
