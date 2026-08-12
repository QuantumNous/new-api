import * as babel from '@babel/core'
import * as t from '@babel/types'
import { parseAst } from '@tanstack/router-utils'
import { describe, expect, it } from 'vitest'
import {
  getObjectPropertyKeyName,
  getUniqueProgramIdentifier,
  normalizePath,
  routeFactoryCallCodeFilter,
} from '../src/core/utils'
import type { NodePath } from '@babel/core'

function matchesRouteFactoryCallCodeFilter(code: string) {
  return routeFactoryCallCodeFilter.some((pattern) => {
    const result = pattern.test(code)
    pattern.lastIndex = 0
    return result
  })
}

function getProgramPath(code: string): NodePath<t.Program> {
  const ast = parseAst({ code })
  let programPath: NodePath<t.Program> | undefined

  babel.traverse(ast, {
    Program(path: NodePath<t.Program>) {
      programPath = path
      path.stop()
    },
  })

  if (!programPath) {
    throw new Error('Program path not found')
  }

  return programPath
}

describe('normalizePath', () => {
  it('should convert Windows backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\project\\src\\routes\\index.tsx')).toBe(
      'C:/Users/project/src/routes/index.tsx',
    )
  })

  it('should handle mixed slashes', () => {
    expect(normalizePath('C:/Users\\project/src\\routes/index.tsx')).toBe(
      'C:/Users/project/src/routes/index.tsx',
    )
  })

  it('should leave forward slashes unchanged', () => {
    expect(normalizePath('/home/user/project/src/routes/index.tsx')).toBe(
      '/home/user/project/src/routes/index.tsx',
    )
  })

  it('should handle relative paths with backslashes', () => {
    expect(normalizePath('src\\routes\\index.tsx')).toBe('src/routes/index.tsx')
  })

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('')
  })

  it('should handle path with query string', () => {
    expect(normalizePath('C:\\project\\file.tsx?tsr-split=component')).toBe(
      'C:/project/file.tsx?tsr-split=component',
    )
  })
})

describe('getUniqueProgramIdentifier', () => {
  it('returns the base name when unused', () => {
    const programPath = getProgramPath('const existing = 1')

    expect(getUniqueProgramIdentifier(programPath, 'TSRComponent').name).toBe(
      'TSRComponent',
    )
  })

  it('appends numeric suffixes for existing bindings', () => {
    const programPath = getProgramPath(
      'const TSRComponent = 1\nconst TSRComponent2 = 2',
    )

    expect(getUniqueProgramIdentifier(programPath, 'TSRComponent').name).toBe(
      'TSRComponent3',
    )
  })

  it('avoids globals too', () => {
    const programPath = getProgramPath('const existing = window')

    expect(getUniqueProgramIdentifier(programPath, 'window').name).toBe(
      'window2',
    )
  })

  it('avoids collisions across consecutive calls with the same base name', () => {
    const programPath = getProgramPath('const existing = 1')

    const first = getUniqueProgramIdentifier(programPath, 'TSRComponent')
    const second = getUniqueProgramIdentifier(programPath, 'TSRComponent')

    expect(first.name).toBe('TSRComponent')
    expect(second.name).toBe('TSRComponent2')
    expect(first.name).not.toBe(second.name)
  })
})

describe('routeFactoryCallCodeFilter', () => {
  it('matches route factory calls with TypeScript type arguments', () => {
    expect(
      matchesRouteFactoryCallCodeFilter(
        'createRootRouteWithContext<MyContext>()({})',
      ),
    ).toBe(true)
  })

  it('matches route factory calls without TypeScript type arguments', () => {
    expect(
      matchesRouteFactoryCallCodeFilter('createRootRouteWithContext()({})'),
    ).toBe(true)
    expect(matchesRouteFactoryCallCodeFilter('createRootRoute({})')).toBe(true)
    expect(
      matchesRouteFactoryCallCodeFilter("createFileRoute('/posts')({})"),
    ).toBe(true)
  })

  it('matches route factory calls with whitespace before invocation', () => {
    expect(
      matchesRouteFactoryCallCodeFilter(
        'createRootRouteWithContext <MyContext>()({})',
      ),
    ).toBe(true)
    expect(matchesRouteFactoryCallCodeFilter('createRootRoute ({})')).toBe(true)
    expect(
      matchesRouteFactoryCallCodeFilter("createFileRoute ('/posts')({})"),
    ).toBe(true)
  })
})

describe('getObjectPropertyKeyName', () => {
  it('returns identifier keys', () => {
    const prop = t.objectProperty(t.identifier('component'), t.identifier('x'))

    expect(getObjectPropertyKeyName(prop)).toBe('component')
  })

  it('returns string literal keys', () => {
    const prop = t.objectProperty(
      t.stringLiteral('errorComponent'),
      t.identifier('x'),
    )

    expect(getObjectPropertyKeyName(prop)).toBe('errorComponent')
  })

  it('returns undefined for computed identifier keys', () => {
    const prop = t.objectProperty(
      t.identifier('component'),
      t.identifier('x'),
      true,
    )

    expect(getObjectPropertyKeyName(prop)).toBeUndefined()
  })

  it('returns undefined for computed member expression keys', () => {
    const prop = t.objectProperty(
      t.memberExpression(t.identifier('foo'), t.identifier('bar')),
      t.identifier('x'),
      true,
    )

    expect(getObjectPropertyKeyName(prop)).toBeUndefined()
  })
})
