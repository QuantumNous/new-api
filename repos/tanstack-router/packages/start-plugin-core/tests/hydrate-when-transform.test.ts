import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as t from '@babel/types'
import { generateFromAst, parseAst } from '@tanstack/router-utils'
import { describe, expect, test } from 'vitest'
import { createHydrateCompilerPlugin } from '../src/hydrate-when-transform'
import type { CompileStartFrameworkOptions } from '../src/types'

const root = '/repo'
const id = '/repo/src/routes/about.tsx'

type HydrateBoundary = {
  id: string
  exportName: string
  index: number
}

function getHydrateBoundariesFromCode(code: string): Array<HydrateBoundary> {
  const boundaries: Array<HydrateBoundary> = []
  const hydrateImportPattern =
    /import\("([^"]*[?&]tss-hydrate=[^"]*)"\),\s*"([^"]+)"/g
  let match: RegExpExecArray | null

  while ((match = hydrateImportPattern.exec(code))) {
    const importId = match[1]!
    const queryIndex = importId.indexOf('?')
    const params = new URLSearchParams(importId.slice(queryIndex + 1))
    const boundaryId = params.get('tss-hydrate')
    const separatorIndex = boundaryId?.indexOf('_') ?? -1
    const index =
      boundaryId && separatorIndex > 0
        ? Number.parseInt(boundaryId.slice(0, separatorIndex), 36)
        : Number.NaN

    if (boundaryId && Number.isInteger(index)) {
      boundaries.push({
        id: boundaryId,
        exportName: match[2]!,
        index,
      })
    }
  }

  return boundaries.sort((a, b) => a.index - b.index)
}

function virtualHydrateId(
  file: string,
  boundary: Pick<HydrateBoundary, 'id' | 'index'>,
) {
  const params = new URLSearchParams()
  params.set('tss-hydrate', boundary.id)
  return `${file}?${params.toString()}`
}

function withSourceHash(id: string, sourceHash: string) {
  const separatorIndex = id.indexOf('_')
  return `${id.slice(0, separatorIndex + 1)}${sourceHash}`
}

function compileHydrate(options: {
  code: string
  id: string
  root: string
  env: 'client' | 'server'
  envName?: string
  framework?: CompileStartFrameworkOptions
  plugin?: ReturnType<typeof createHydrateCompilerPlugin>
}) {
  const plugin = options.plugin ?? createHydrateCompilerPlugin()
  const envName = options.envName ?? options.env
  const ast = parseAst({ code: options.code, sourceFilename: options.id })
  const result = plugin.transformAst?.({
    ast,
    code: options.code,
    id: options.id,
    root: options.root,
    env: options.env,
    envName,
    mode: 'dev',
    framework: options.framework ?? 'react',
    providerEnvName: 'ssr',
    types: t,
    parseExpression: (expressionCode) => t.identifier(expressionCode),
  })
  if (!result) return null

  const generated = generateFromAst(ast, {
    sourceMaps: true,
    sourceFileName: options.id,
    filename: options.id,
  })

  return {
    code: generated.code,
    map: generated.map,
    boundaries: getHydrateBoundariesFromCode(generated.code),
    plugin,
  }
}

function loadVirtualHydrateModule(options: {
  code: string
  id: string
  root: string
  envName?: string
}) {
  const plugin = createHydrateCompilerPlugin()
  return plugin.loadVirtualModule?.({
    code: options.code,
    id: options.id,
    root: options.root,
    env: 'client',
    envName: options.envName ?? 'client',
  })
}

describe('Hydrate compiler transform', () => {
  test('splits Hydrate children behind a lazy import', () => {
    const result = compileHydrate({
      code: `
        import { Hydrate } from '@tanstack/react-start'
        import { visible } from '@tanstack/react-start/hydration'

        export function Page() {
          return (
            <Hydrate when={visible()}>
              <Widget title="Hello" />
            </Hydrate>
          )
        }

        function Widget(props: { title: string }) {
          return <p>{props.title}</p>
        }
      `,
      id,
      root,
      env: 'client',
    })

    expect(result?.code).toContain('lazyRouteComponent')
    expect(result?.code).toContain('tss-hydrate=')
    expect(result?.code).not.toContain('tss-hydrate-index')
    expect(result?.code).not.toContain('createElement')
    expect(result?.code).toContain('h=')
    expect(result?.code).not.toContain('p=')
  })

  test('uses the Solid Router import source for Solid Hydrate boundaries', () => {
    const result = compileHydrate({
      code: `
        import { Hydrate } from '@tanstack/solid-start'
        import { visible } from '@tanstack/solid-start/hydration'

        export function Page() {
          return (
            <Hydrate when={visible()}>
              <Widget title="Hello" />
            </Hydrate>
          )
        }

        function Widget(props: { title: string }) {
          return <p>{props.title}</p>
        }
      `,
      id,
      root,
      env: 'client',
      framework: 'solid',
    })

    expect(result?.code).toContain(
      'lazyRouteComponent } from "@tanstack/solid-router"',
    )
    expect(result?.code).toContain('tss-hydrate=')
    expect(result?.code).toContain('h=')
    expect(result?.code).not.toContain('p=')
  })

  test('rejects function-as-children unless the boundary opts out of splitting', () => {
    expect(() =>
      compileHydrate({
        code: `
          import { Hydrate } from '@tanstack/react-start'
          import { idle } from '@tanstack/react-start/hydration'

          export function Page() {
            return (
              <Hydrate when={idle()}>
                {() => <p>child</p>}
              </Hydrate>
            )
          }
        `,
        id,
        root,
        env: 'client',
      }),
    ).toThrow(/function-as-children/)
  })

  test('rejects hook calls that would be moved into an extracted component', () => {
    expect(() =>
      compileHydrate({
        code: `
          import { Hydrate } from '@tanstack/react-start'
          import { idle } from '@tanstack/react-start/hydration'

          function useThing() {
            return 'thing'
          }

          export function Page() {
            return (
              <Hydrate when={idle()}>
                <p>{useThing()}</p>
              </Hydrate>
            )
          }
        `,
        id,
        root,
        env: 'client',
      }),
    ).toThrow(/hooks/)
  })

  test('strips Hydrate fallback from the server transform', () => {
    const result = compileHydrate({
      code: `
        import { Hydrate } from '@tanstack/react-start'
        import { idle, visible } from '@tanstack/react-start/hydration'

        const spreadProps = {
          when: visible(),
          fallback: <div data-testid="server-bound-spread">bound</div>,
        }

        export function Page() {
          return (
            <>
              <Hydrate
                when={visible()}
                fallback={<div data-testid="server-fallback">fallback</div>}
              >
                <Widget title="split" />
              </Hydrate>
              <Hydrate
                when={idle()}
                split={false}
                fallback={<div data-testid="server-inline">inline</div>}
              >
                <Widget title="inline" />
              </Hydrate>
              <Hydrate
                {...{
                  when: visible(),
                  fallback: <div data-testid="server-spread">spread</div>,
                }}
              >
                <Widget title="spread" />
              </Hydrate>
              <Hydrate {...spreadProps}>
                <Widget title="bound-spread" />
              </Hydrate>
            </>
          )
        }

        function Widget(props: { title: string }) {
          return <p>{props.title}</p>
        }
      `,
      id,
      root,
      env: 'server',
    })

    expect(result?.code).not.toContain('fallback=')
    expect(result?.code).not.toContain('fallback:')
    expect(result?.code).not.toContain('server-fallback')
    expect(result?.code).not.toContain('server-inline')
    expect(result?.code).not.toContain('server-spread')
    expect(result?.code).not.toContain('server-bound-spread')
    expect(result?.code).toContain('h=')
    expect(result?.code).toContain('<Widget title="split" />')
    expect(result?.code).toContain('<Widget title="inline" />')
    expect(result?.code).toContain('<Widget title="spread" />')
    expect(result?.code).toContain('<Widget title="bound-spread" />')
  })

  test('supports nested Hydrate boundaries in extracted virtual modules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const code = `
      import { Hydrate } from '@tanstack/react-start'
      import { interaction, visible } from '@tanstack/react-start/hydration'

      const unused = 'remove me'

      export function Page() {
        return (
          <Hydrate when={visible()}>
            <section>
              <Hydrate when={interaction()}>
                <button>Nested</button>
              </Hydrate>
            </section>
          </Hydrate>
        )
      }
    `
    const firstPass = compileHydrate({
      code,
      id: file,
      root: dir,
      env: 'client',
    })
    expect(firstPass?.boundaries).toHaveLength(1)

    const virtualId = virtualHydrateId(file, firstPass!.boundaries[0]!)
    const virtualModule = loadVirtualHydrateModule({
      code,
      id: virtualId,
      root: dir,
    })
    expect(virtualModule?.code).not.toContain('remove me')

    const boundaryIndex = firstPass!.boundaries[0]!.index
    const nestedPass = compileHydrate({
      code: virtualModule!.code,
      id: virtualId,
      root: dir,
      env: 'client',
    })

    expect(boundaryIndex).toBe(0)
    expect(nestedPass?.code).toContain('H1')
    expect(nestedPass?.code).toContain('tss-hydrate=')
  })

  test('keeps sibling boundary ids stable after nested boundaries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const code = `
      import { Hydrate } from '@tanstack/react-start'
      import { idle, interaction, visible } from '@tanstack/react-start/hydration'

      export function Page() {
        return (
          <>
            <Hydrate when={visible()}>
              <section>
                <Hydrate when={interaction()}>
                  <button>Nested</button>
                </Hydrate>
              </section>
            </Hydrate>
            <Hydrate when={idle()}>
              <p>Sibling</p>
            </Hydrate>
          </>
        )
      }
    `
    const firstPass = compileHydrate({
      code,
      id: file,
      root: dir,
      env: 'client',
    })
    expect(
      firstPass?.boundaries.map((boundary) => boundary.exportName),
    ).toEqual(['H0', 'H2'])

    const siblingBoundary = firstPass!.boundaries[1]!
    const virtualId = virtualHydrateId(file, siblingBoundary)
    const boundaryIndex = siblingBoundary.index
    const virtualModule = loadVirtualHydrateModule({
      code,
      id: virtualId,
      root: dir,
    })
    const parentVirtualId = virtualHydrateId(file, firstPass!.boundaries[0]!)
    const parentVirtualModule = loadVirtualHydrateModule({
      code,
      id: parentVirtualId,
      root: dir,
    })
    const nestedPass = compileHydrate({
      code: parentVirtualModule!.code,
      id: parentVirtualId,
      root: dir,
      env: 'client',
    })
    const serverPass = compileHydrate({
      code,
      id: file,
      root: dir,
      env: 'server',
    })

    expect(boundaryIndex).toBe(2)
    expect(virtualModule?.code).toContain('Sibling')
    expect(virtualModule?.code).not.toContain('Nested')
    expect(nestedPass?.boundaries[0]?.exportName).toBe('H1')
    expect(serverPass?.code).toContain(firstPass!.boundaries[0]!.id)
    expect(serverPass?.code).toContain(nestedPass!.boundaries[0]!.id)
    expect(serverPass?.code).toContain(siblingBoundary.id)
  })

  test('loads virtual modules from supplied bundler code instead of the filesystem', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const oldCode = `
      import { Hydrate } from '@tanstack/react-start'
      import { visible } from '@tanstack/react-start/hydration'

      export function Page() {
        return <Hydrate when={visible()}><p>Old</p></Hydrate>
      }
    `
    const nextCode = oldCode.replace('Old', 'New')
    const firstPass = compileHydrate({
      code: oldCode,
      id: file,
      root: dir,
      env: 'client',
    })
    const virtualModule = loadVirtualHydrateModule({
      code: nextCode,
      id: virtualHydrateId(file, firstPass!.boundaries[0]!),
      root: dir,
    })

    expect(virtualModule?.code).toContain('New')
    expect(virtualModule?.code).not.toContain('Old')
  })

  test('captures identifiers used by shorthand objects and computed members', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const code = `
      import { Hydrate } from '@tanstack/react-start'
      import { visible } from '@tanstack/react-start/hydration'

      export function Page() {
        const key = 'name'
        const items = { name: 'Ada' }
        return (
          <Hydrate when={visible()}>
            <Widget data={{ key, value: items[key] }} />
          </Hydrate>
        )
      }

      function Widget(props: { data: { key: string; value: string } }) {
        return <p>{props.data.value}</p>
      }
    `
    const firstPass = compileHydrate({
      code,
      id: file,
      root: dir,
      env: 'client',
    })
    const virtualModule = loadVirtualHydrateModule({
      code,
      id: virtualHydrateId(file, firstPass!.boundaries[0]!),
      root: dir,
    })

    expect(virtualModule?.code).toContain('export function H0({')
    expect(virtualModule?.code).toContain('items')
    expect(virtualModule?.code).toContain('key')
    expect(virtualModule?.code).toContain('items[key]')
  })

  test('unwraps exported declarations needed by extracted virtual modules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const code = `
      import { createFileRoute } from '@tanstack/react-router'
      import { Hydrate } from '@tanstack/react-start'
      import { visible } from '@tanstack/react-start/hydration'

      export const Route = createFileRoute('/test')({
        component: Page,
      })

      export const label = 'Ada'

      export const Widget = () => {
        return <p>{label}</p>
      }

      function Page() {
        return <Hydrate when={visible()}><Widget /></Hydrate>
      }
    `
    const firstPass = compileHydrate({
      code,
      id: file,
      root: dir,
      env: 'client',
    })
    const virtualModule = loadVirtualHydrateModule({
      code,
      id: virtualHydrateId(file, firstPass!.boundaries[0]!),
      root: dir,
    })

    expect(virtualModule?.code).toContain('const Widget')
    expect(virtualModule?.code).toContain('const label')
    expect(virtualModule?.code).toContain('<Widget />')
    expect(virtualModule?.code).not.toContain('export const Widget')
    expect(virtualModule?.code).not.toContain('createFileRoute')
    expect(virtualModule?.code).not.toContain('const Route')
  })

  test('invalidates cached Hydrate source for virtual module loads', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydrate-when-'))
    const file = join(dir, 'route.tsx')
    const oldCode = `
      import { Hydrate } from '@tanstack/react-start'
      import { visible } from '@tanstack/react-start/hydration'

      export function Page() {
        return <Hydrate when={visible()}><p>Old</p></Hydrate>
      }
    `
    const nextCode = oldCode.replace('Old', 'New')
    const envName = 'client'
    const plugin = createHydrateCompilerPlugin()
    const transformed = compileHydrate({
      code: oldCode,
      id: file,
      root: dir,
      env: 'client',
      envName,
      plugin,
    })
    const virtualId = virtualHydrateId(file, transformed!.boundaries[0]!)

    expect(
      transformed!.plugin.loadVirtualModule?.({
        id: virtualId,
        root: dir,
        env: 'client',
        envName,
      })?.code,
    ).toContain('Old')

    transformed!.plugin.invalidateModule?.({ id: file, envName })
    expect(() =>
      transformed!.plugin.loadVirtualModule?.({
        id: virtualId,
        root: dir,
        env: 'client',
        envName,
      }),
    ).toThrow(/Missing Hydrate source/)

    const updated = compileHydrate({
      code: nextCode,
      id: file,
      root: dir,
      env: 'client',
      envName,
      plugin,
    })

    expect(
      updated!.plugin.loadVirtualModule?.({
        id: virtualId,
        root: dir,
        env: 'client',
        envName,
      })?.code,
    ).toContain('New')
  })

  test('rejects virtual module ids whose source hash does not match', () => {
    const code = `
      import { Hydrate } from '@tanstack/react-start'
      import { idle, visible } from '@tanstack/react-start/hydration'

      export function Page() {
        return (
          <>
            <Hydrate when={visible()}><p>First</p></Hydrate>
            <Hydrate when={idle()}><p>Second</p></Hydrate>
          </>
        )
      }
    `
    const firstPass = compileHydrate({
      code,
      id,
      root,
      env: 'client',
    })
    const mismatchedId = virtualHydrateId(id, {
      id: withSourceHash(firstPass!.boundaries[0]!.id, 'mismatch'),
      index: firstPass!.boundaries[0]!.index,
    })

    expect(
      new URLSearchParams(mismatchedId.split('?')[1]).get('tss-hydrate'),
    ).toMatch(/_mismatch$/)
    expect(
      loadVirtualHydrateModule({ code, id: mismatchedId, root }),
    ).toBeNull()
  })
})
