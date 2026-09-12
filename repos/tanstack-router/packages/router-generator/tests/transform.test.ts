import { describe, expect, it } from 'vitest'
import { transform } from '../src/transform/transform'
import type { RouteNode } from '../src/types'

function makeNode(
  fsRouteType: RouteNode['_fsRouteType'] = 'static',
): RouteNode {
  return {
    filePath: '/test.tsx',
    fullPath: '/test.tsx',
    variableName: 'TestRoute',
    _fsRouteType: fsRouteType,
  }
}

describe('transform', () => {
  it('does not treat root route exports as missing Route exports', async () => {
    const result = await transform({
      source: [
        "import { createRootRoute } from '@tanstack/react-router'",
        '',
        'export const Route = createRootRoute()({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/',
        lazy: false,
      },
      node: makeNode('__root'),
    })

    expect(result.result).toBe('not-modified')
  })

  it('does not treat createRootRouteWithContext exports as missing Route exports', async () => {
    const result = await transform({
      source: [
        "import { createRootRouteWithContext } from '@tanstack/react-router'",
        '',
        'interface RouterContext {}',
        '',
        'export const Route = createRootRouteWithContext<RouterContext>()({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/',
        lazy: false,
      },
      node: makeNode('__root'),
    })

    expect(result.result).toBe('not-modified')
  })

  it('does not treat createRootRoute exported via export { Route } as missing Route exports', async () => {
    const result = await transform({
      source: [
        "import { createRootRoute } from '@tanstack/react-router'",
        '',
        'const Route = createRootRoute()({})',
        '',
        'export { Route }',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/',
        lazy: false,
      },
      node: makeNode('__root'),
    })

    expect(result.result).toBe('not-modified')
  })

  it('returns an error result for parse failures', async () => {
    const result = await transform({
      source: "export const Route = createFileRoute('/broken')(",
      ctx: {
        target: 'react',
        routeId: '/broken',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('error')
  })

  it('rewrites an aliased exported Route binding', async () => {
    const node = makeNode()
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        "const MyRoute = createFileRoute('/old')({ component: Component })",
        '',
        'export { MyRoute as Route }',
        '',
        'function Component() {',
        '  return null',
        '}',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node,
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain("createFileRoute('/new')")
    expect(node.createFileRouteProps).toEqual(new Set(['component']))
  })

  it('removes imports cleanly with CRLF line endings', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        "import { createLazyFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/old')({})",
      ].join('\r\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toBe(
      [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/new')({})",
      ].join('\r\n'),
    )
  })

  it('preserves import formatting when only renaming the route constructor', async () => {
    const result = await transform({
      source: [
        'import {',
        '  Link,',
        '  createFileRoute,',
        `} from '@tanstack/react-router'`,
        '',
        "export const Route = createFileRoute('/old')({})",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: true,
      },
      node: makeNode('lazy'),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toBe(
      [
        'import {',
        '  Link,',
        '  createLazyFileRoute,',
        `} from '@tanstack/react-router'`,
        '',
        "export const Route = createLazyFileRoute('/new')({})",
      ].join('\n'),
    )
  })

  it('adds the missing constructor import with the file line ending', async () => {
    const result = await transform({
      source: [
        "import { Link } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/old')({})",
      ].join('\r\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toBe(
      [
        "import { Link, createFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/new')({})",
      ].join('\r\n'),
    )
  })

  it('ignores non-exported route constructor calls in the same file', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        "const OtherRoute = createFileRoute('/other')({})",
        "export const Route = createFileRoute('/old')({})",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain(
      "const OtherRoute = createFileRoute('/other')({})",
    )
    expect(result.output).toContain(
      "export const Route = createFileRoute('/new')({})",
    )
  })

  it('returns an error for unsupported route id expressions', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        'const routeId = getRouteId()',
        'export const Route = createFileRoute(routeId)({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('error')
    if (result.result !== 'error') {
      throw new Error(`expected error result, got ${result.result}`)
    }
    expect(String(result.error)).toContain(
      'expected route id to be a string literal or plain template literal',
    )
  })

  it('returns a distinct error for malformed direct createFileRoute calls', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        'export const Route = createFileRoute({ component: Home })',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('error')
    if (result.result !== 'error') {
      throw new Error(`expected error result, got ${result.result}`)
    }
    expect(String(result.error)).toContain(
      "expected Route export in /new to use createFileRoute('/path')({...}) or createLazyFileRoute('/path')({...})",
    )
  })

  it('returns a distinct error for malformed direct createLazyFileRoute calls', async () => {
    const result = await transform({
      source: [
        "import { createLazyFileRoute } from '@tanstack/react-router'",
        '',
        'export const Route = createLazyFileRoute({ component: Home })',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: true,
      },
      node: makeNode('lazy'),
    })

    expect(result.result).toBe('error')
    if (result.result !== 'error') {
      throw new Error(`expected error result, got ${result.result}`)
    }
    expect(String(result.error)).toContain(
      "expected Route export in /new to use createFileRoute('/path')({...}) or createLazyFileRoute('/path')({...})",
    )
  })

  it('preserves double-quote route IDs', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        'export const Route = createFileRoute("/old")({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain('createFileRoute("/new")')
  })

  it('preserves template-literal route IDs', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        'export const Route = createFileRoute(`/old`)({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain('createFileRoute(`/new`)')
  })

  it('rewrites createLazyFileRoute to createFileRoute when lazy changes', async () => {
    const result = await transform({
      source: [
        "import { createLazyFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createLazyFileRoute('/test')({})",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/test',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain("createFileRoute('/test')")
    expect(result.output).not.toContain('createLazyFileRoute')
  })

  it('handles export { Route } with a separate const declaration', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        "const Route = createFileRoute('/old')({})",
        '',
        'export { Route }',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain("createFileRoute('/new')")
  })

  it('returns an error for multiple exported route calls', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createFileRoute('/a')({})",
        '',
        "const AltRoute = createFileRoute('/b')({})",
        'export { AltRoute as Route }',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('error')
    if (result.result !== 'error') {
      throw new Error(`expected error result, got ${result.result}`)
    }
    expect(String(result.error)).toContain(
      'expected exactly one createFileRoute/createLazyFileRoute call',
    )
  })

  it('prepends a new import when no target-module import exists', async () => {
    const result = await transform({
      source: [
        "import { useState } from 'react'",
        '',
        "export const Route = createFileRoute('/old')({})",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toBe(
      [
        "import { createFileRoute } from '@tanstack/react-router'",
        "import { useState } from 'react'",
        '',
        "export const Route = createFileRoute('/new')({})",
      ].join('\n'),
    )
  })

  it('returns not-modified for a non-route-constructor call', async () => {
    const result = await transform({
      source: [
        "import { createFileRoute } from '@tanstack/react-router'",
        '',
        'export const Route = someOtherFactory()({})',
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/test',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('not-modified')
  })

  it('preserves semicolons in normalized imports', async () => {
    const result = await transform({
      source: [
        "import { createLazyFileRoute } from '@tanstack/react-router';",
        '',
        "export const Route = createLazyFileRoute('/old')({});",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain(
      "import { createFileRoute } from '@tanstack/react-router';",
    )
    expect(result.output).not.toContain('createLazyFileRoute')
  })

  it('preserves type import specifiers when normalizing route imports', async () => {
    const result = await transform({
      source: [
        "import { type LinkProps, createLazyFileRoute } from '@tanstack/react-router'",
        '',
        "export const Route = createLazyFileRoute('/old')({})",
      ].join('\n'),
      ctx: {
        target: 'react',
        routeId: '/new',
        lazy: false,
      },
      node: makeNode(),
    })

    expect(result.result).toBe('modified')
    if (result.result !== 'modified') {
      throw new Error(`expected modified result, got ${result.result}`)
    }
    expect(result.output).toContain(
      "import { type LinkProps, createFileRoute } from '@tanstack/react-router'",
    )
    expect(result.output).not.toContain('createLazyFileRoute')
  })
})
