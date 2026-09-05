import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { compileCodeSplitReferenceRoute } from '../src/core/code-splitter/compilers'
import { defaultCodeSplitGroupings } from '../src/core/constants'
import { getReferenceRouteCompilerPlugins } from '../src/core/code-splitter/plugins/framework-plugins'
import { createRouteHmrStatement } from '../src/core/hmr'
import { frameworks } from './constants'

function getFrameworkDir(framework: string) {
  const files = path.resolve(__dirname, `./add-hmr/test-files/${framework}`)
  const snapshots = path.resolve(__dirname, `./add-hmr/snapshots/${framework}`)
  return { files, snapshots }
}

describe('add-hmr works', () => {
  describe.each(frameworks)('FRAMEWORK=%s', async (framework) => {
    const dirs = getFrameworkDir(framework)
    const filenames = await readdir(dirs.files)

    it.each(filenames)(
      `should add hmr in "reference" for "%s"`,
      async (filename) => {
        const file = await readFile(path.join(dirs.files, filename))
        const code = file.toString()

        const compileResult = compileCodeSplitReferenceRoute({
          code,
          filename,
          id: filename,
          addHmr: true,
          codeSplitGroupings: defaultCodeSplitGroupings,
          targetFramework: framework,
          compilerPlugins: getReferenceRouteCompilerPlugins({
            targetFramework: framework,
            addHmr: true,
          }),
        })

        await expect(compileResult?.code || code).toMatchFileSnapshot(
          path.join(dirs.snapshots, filename.replace('.tsx', '@true.tsx')),
        )
      },
    )

    it.each(filenames)(
      `should NOT add hmr in "reference" for "%s"`,
      async (filename) => {
        const file = await readFile(path.join(dirs.files, filename))
        const code = file.toString()

        const compileResult = compileCodeSplitReferenceRoute({
          code,
          filename,
          id: filename,
          addHmr: false,
          codeSplitGroupings: defaultCodeSplitGroupings,
          targetFramework: framework,
          compilerPlugins: getReferenceRouteCompilerPlugins({
            targetFramework: framework,
            addHmr: false,
          }),
        })

        await expect(compileResult?.code || code).toMatchFileSnapshot(
          path.join(dirs.snapshots, filename.replace('.tsx', '@false.tsx')),
        )
      },
    )
  })

  it('supports configurable webpackHot HMR code generation', async () => {
    const filename = 'arrow-function.tsx'
    const framework = 'react'
    const file = await readFile(
      path.join(getFrameworkDir(framework).files, filename),
    )
    const code = file.toString()

    const compileResult = compileCodeSplitReferenceRoute({
      code,
      filename,
      id: filename,
      addHmr: true,
      hmrStyle: 'webpack',
      codeSplitGroupings: defaultCodeSplitGroupings,
      targetFramework: framework,
      compilerPlugins: getReferenceRouteCompilerPlugins({
        targetFramework: framework,
        addHmr: true,
        hmrStyle: 'webpack',
      }),
    })

    await expect(compileResult?.code || code).toMatchFileSnapshot(
      path.join(
        getFrameworkDir(framework).snapshots,
        filename.replace('.tsx', '@webpack-hot.tsx'),
      ),
    )
  })

  it('supports configurable webpackHot unsplittable HMR generation', async () => {
    const statement = createRouteHmrStatement([], {
      hmrStyle: 'webpack',
      targetFramework: 'react',
    })
    const output = JSON.stringify(statement)

    expect(output).toContain('webpackHot')
    expect(output).not.toContain('import.meta.hot')
    expect(output).toContain('oldHasShellComponent')
    expect(output).toContain('__routeContext')
  })

  it('supports configurable Vite unsplittable HMR generation', async () => {
    const statement = createRouteHmrStatement([], {
      hmrStyle: 'vite',
      targetFramework: 'react',
    })
    const output = JSON.stringify(statement)

    expect(output).toContain('MetaProperty')
    expect(output).toContain('hot')
    expect(output).not.toContain('webpackHot')
    expect(output).toContain('newModule')
  })

  it('uses a generated route id fallback for Vite HMR', async () => {
    const statement = createRouteHmrStatement([], {
      hmrStyle: 'vite',
      targetFramework: 'react',
      routeId: '/posts',
    })
    const output = JSON.stringify(statement)

    expect(output).toContain('tsr-route-id')
    expect(output).toContain('/posts')
  })

  it('prefers the current generated route id over stale Vite hot data', async () => {
    const statement = createRouteHmrStatement([], {
      hmrStyle: 'vite',
      targetFramework: 'react',
      routeId: '/current-route',
    })
    const output = JSON.stringify(statement)

    expect(output).toContain('"name":"initialRouteId"')
    expect(output).toContain(
      '"operator":"??","left":{"type":"StringLiteral","value":"/current-route"',
    )
    expect(output).toContain('"object":{"type":"Identifier","name":"hotData"}')
  })

  it('normalizes the generated root route id for Vite HMR', async () => {
    const statement = createRouteHmrStatement([], {
      hmrStyle: 'vite',
      targetFramework: 'react',
      routeId: '/__root',
    })
    const output = JSON.stringify(statement)

    expect(output).toContain('__root__')
    expect(output).not.toContain('/__root')
  })
})
