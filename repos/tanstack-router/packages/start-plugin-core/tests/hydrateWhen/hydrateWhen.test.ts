import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import * as t from '@babel/types'
import { generateFromAst, parseAst } from '@tanstack/router-utils'
import { describe, expect, test } from 'vitest'
import { createHydrateCompilerPlugin } from '../../src/hydrate-when-transform'

const fixtureRoot = path.resolve(import.meta.dirname, './test-files')
const errorRoot = path.resolve(import.meta.dirname, './error-files')

function fixtureId(filename: string) {
  return path.join(fixtureRoot, filename)
}

function normalizeSnapshotCode(code: string) {
  return code.split(fixtureRoot).join('<fixtureRoot>')
}

async function readFixture(filename: string) {
  return await readFile(fixtureId(filename), 'utf8')
}

async function getFilenames(dirname: string) {
  return (await readdir(dirname))
    .filter((filename) => filename.endsWith('.tsx'))
    .sort()
}

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

function compile(opts: {
  env: 'client' | 'server'
  code: string
  id: string
  root?: string
}) {
  const options = {
    ...opts,
    root: opts.root ?? fixtureRoot,
  }
  const plugin = createHydrateCompilerPlugin()
  const ast = parseAst({ code: options.code, sourceFilename: options.id })
  const result = plugin.transformAst?.({
    ast,
    code: options.code,
    id: options.id,
    root: options.root,
    env: options.env,
    envName: options.env,
    mode: 'dev',
    framework: 'react',
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
  }
}

function loadVirtualHydrateModule(options: {
  code: string
  id: string
  root: string
}) {
  return createHydrateCompilerPlugin().loadVirtualModule?.({
    code: options.code,
    id: options.id,
    root: options.root,
    env: 'client',
    envName: 'client',
  })
}

function virtualHydrateId(
  file: string,
  boundary: Pick<HydrateBoundary, 'id' | 'index'>,
) {
  const params = new URLSearchParams()
  params.set('tss-hydrate', boundary.id)
  return `${file}?${params.toString()}`
}

describe('Hydrate compiler transform fixtures', async () => {
  const filenames = await getFilenames(fixtureRoot)

  describe.each(filenames)('should handle "%s"', async (filename) => {
    const code = await readFixture(filename)
    const id = fixtureId(filename)

    test(`should compile ${filename} for client`, async () => {
      const result = compile({ env: 'client', code, id })

      await expect(
        normalizeSnapshotCode(result?.code ?? 'no-transform'),
      ).toMatchFileSnapshot(`./snapshots/client/${filename}`)
    })

    test(`should compile ${filename} for server`, async () => {
      const result = compile({ env: 'server', code, id })

      await expect(
        normalizeSnapshotCode(result?.code ?? 'no-transform'),
      ).toMatchFileSnapshot(`./snapshots/server/${filename}`)
    })
  })

  test('should extract virtual modules and keep nested ids stable', async () => {
    const filename = 'hydrateWhenNested.tsx'
    const code = await readFixture(filename)
    const id = fixtureId(filename)
    const firstPass = compile({ env: 'client', code, id })

    expect(
      firstPass?.boundaries.map((boundary) => boundary.exportName),
    ).toEqual(['H0', 'H2'])

    for (const boundary of firstPass!.boundaries) {
      const virtualId = virtualHydrateId(id, boundary)
      const loaded = loadVirtualHydrateModule({
        code,
        id: virtualId,
        root: fixtureRoot,
      })

      await expect(
        normalizeSnapshotCode(loaded?.code ?? 'no-virtual-module'),
      ).toMatchFileSnapshot(
        `./snapshots/virtual/${filename}.${boundary.exportName}.tsx`,
      )
    }

    const parentBoundary = firstPass!.boundaries[0]!
    const parentVirtualId = virtualHydrateId(id, parentBoundary)
    const parentVirtualModule = loadVirtualHydrateModule({
      code,
      id: parentVirtualId,
      root: fixtureRoot,
    })
    const nestedPass = compile({
      code: parentVirtualModule!.code,
      id: parentVirtualId,
      env: 'client',
    })

    await expect(
      normalizeSnapshotCode(nestedPass?.code ?? 'no-transform'),
    ).toMatchFileSnapshot(`./snapshots/virtual/${filename}.H0.client.tsx`)
  })
})

describe('Hydrate compiler extraction errors', async () => {
  const errorCases = [
    {
      filename: 'hydrateWhenFunctionChild.tsx',
      message: /function-as-children/,
    },
    {
      filename: 'hydrateWhenHookCall.tsx',
      message: /hooks/,
    },
    {
      filename: 'hydrateWhenThisCapture.tsx',
      message: /captures this/,
    },
    {
      filename: 'hydrateWhenSuperCapture.tsx',
      message: /captures super/,
    },
  ] as const

  describe.each(errorCases)('$filename', async ({ filename, message }) => {
    const code = await readFile(path.join(errorRoot, filename), 'utf8')
    const id = path.join(errorRoot, filename)

    test('should reject unsafe client extraction', () => {
      expect(() =>
        compile({
          code,
          id,
          root: errorRoot,
          env: 'client',
        }),
      ).toThrow(message)
    })

    test('should reject unsafe server extraction', () => {
      expect(() =>
        compile({
          code,
          id,
          root: errorRoot,
          env: 'server',
        }),
      ).toThrow(message)
    })
  })
})
