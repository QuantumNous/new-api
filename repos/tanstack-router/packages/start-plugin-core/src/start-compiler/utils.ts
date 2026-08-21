import { codeFrameColumns } from '@babel/code-frame'
import * as t from '@babel/types'
import type babel from '@babel/core'

export function codeFrameError(
  code: string,
  loc: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  },
  message: string,
) {
  const frame = codeFrameColumns(
    code,
    {
      start: loc.start,
      end: loc.end,
    },
    {
      highlightCode: true,
      message,
    },
  )

  return new Error(frame)
}

export function cleanId(id: string): string {
  // Remove null byte prefix used by Vite/Rollup for virtual modules
  if (id.startsWith('\0')) {
    id = id.slice(1)
  }
  const queryIndex = id.indexOf('?')
  return queryIndex === -1 ? id : id.substring(0, queryIndex)
}

/**
 * Strips a method call by replacing it with its callee object.
 * E.g., `foo().bar()` -> `foo()`
 *
 * This is a common pattern used when removing method calls from chains
 * (e.g., removing .server() from middleware on client, or .validator() on client).
 *
 * @param callPath - The path to the CallExpression to strip
 */
export function stripMethodCall(
  callPath: babel.NodePath<t.CallExpression>,
): void {
  if (t.isMemberExpression(callPath.node.callee)) {
    callPath.replaceWith(callPath.node.callee.object)
  }
}
