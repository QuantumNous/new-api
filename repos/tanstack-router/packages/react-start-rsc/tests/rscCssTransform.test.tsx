import { describe, expect, test } from 'vitest'
import {
  StartCompiler,
  detectKindsInCode,
  getLookupKindsForEnv,
} from '../../start-plugin-core/src/start-compiler/compiler'
import { getLookupConfigurationsForEnv } from '../../start-plugin-core/src/start-compiler/config'
import { createRscCssCompilerTransforms } from '../src/plugin/rscCssTransform'
import type { StartCompilerImportTransform } from '../../start-plugin-core/src/types'

const TSS_SERVERFN_SPLIT_PARAM = 'tss-serverfn-split'

async function compileWithRscCssTransform(opts: {
  code: string
  id?: string | undefined
  loadCssExpression?: string | undefined
  serverFnProviderOnly?: boolean | undefined
}) {
  const compilerTransforms = createRscCssCompilerTransforms({
    loadCssExpression:
      opts.loadCssExpression ?? 'import.meta.viteRsc.loadCss()',
    serverFnProviderOnly: opts.serverFnProviderOnly,
  })

  const compiler = new StartCompiler({
    env: 'server',
    envName: 'rsc',
    root: '/test',
    framework: 'react',
    providerEnvName: 'rsc',
    mode: 'build',
    lookupKinds: getLookupKindsForEnv('server', { compilerTransforms }),
    lookupConfigurations: getLookupConfigurationsForEnv('server', 'react', {
      compilerTransforms,
    }),
    compilerTransforms,
    getKnownServerFns: () => ({}),
    loadModule: async () => {},
    resolveId: async (id) => id,
  })

  const result = await compiler.compile({
    id: opts.id ?? '/test/src/route.tsx',
    code: opts.code,
    detectedKinds: detectKindsInCode(opts.code, 'server', {
      compilerTransforms,
    }),
  })

  return result?.code ?? null
}

describe('RSC CSS compiler transforms', () => {
  test('injects Vite CSS resources into all supported RSC render APIs', async () => {
    const code = await compileWithRscCssTransform({
      code: `
        import {
          createCompositeComponent,
          renderServerComponent,
          renderToReadableStream,
        } from '@tanstack/react-start/rsc'

        export const renderable = renderServerComponent(<Card kind="renderable" />)
        export const composite = createCompositeComponent(() => ({
          Card: <Card kind="composite" />,
        }))
        export const stream = renderToReadableStream(<Card kind="stream" />)
      `,
    })

    expect(code).toMatchInlineSnapshot(`
      "import { createCompositeComponent, renderServerComponent, renderToReadableStream } from '@tanstack/react-start/rsc';
      export const renderable = renderServerComponent(<Card kind="renderable" />, {
        __tanstackStartRscCss: import.meta.viteRsc.loadCss()
      });
      export const composite = createCompositeComponent(() => ({
        Card: <Card kind="composite" />
      }), {
        __tanstackStartRscCss: import.meta.viteRsc.loadCss()
      });
      export const stream = renderToReadableStream(<>{import.meta.viteRsc.loadCss()}<Card kind="stream" /></>);"
    `)
  })

  test('does not rewrite calls outside the transform constraints', async () => {
    const code = await compileWithRscCssTransform({
      code: `
        import {
          renderServerComponent,
          renderToReadableStream,
        } from '@tanstack/react-start/rsc'

        const node = <Card />
        export const existingOptions = renderServerComponent(<Card />, {
          alreadyConfigured: true,
        })
        export const nonJsxStream = renderToReadableStream(node)
      `,
    })

    expect(code).toMatchInlineSnapshot(`
      "import { renderServerComponent, renderToReadableStream } from '@tanstack/react-start/rsc';
      const node = <Card />;
      export const existingOptions = renderServerComponent(<Card />, {
        alreadyConfigured: true
      });
      export const nonJsxStream = renderToReadableStream(node);"
    `)
  })

  test('honors provider-only transforms for Rsbuild', async () => {
    const source = `
      import { renderServerComponent } from '@tanstack/react-start/rsc'

      export const renderable = renderServerComponent(<Card />)
    `

    const callerCode = await compileWithRscCssTransform({
      code: source,
      loadCssExpression: 'import.meta.rspackRsc.loadCss()',
      serverFnProviderOnly: true,
    })

    const providerCode = await compileWithRscCssTransform({
      code: source,
      id: `/test/src/route.tsx?${TSS_SERVERFN_SPLIT_PARAM}`,
      loadCssExpression: 'import.meta.rspackRsc.loadCss()',
      serverFnProviderOnly: true,
    })

    expect({ callerCode, providerCode }).toMatchInlineSnapshot(`
      {
        "callerCode": "import { renderServerComponent } from '@tanstack/react-start/rsc';
      export const renderable = renderServerComponent(<Card />);",
        "providerCode": "import { renderServerComponent } from '@tanstack/react-start/rsc';
      export const renderable = renderServerComponent(<Card />, {
        __tanstackStartRscCss: import.meta.rspackRsc.loadCss()
      });",
      }
    `)
  })

  test('detects transform imports without enabling them outside server builds', () => {
    const compilerTransforms: Array<StartCompilerImportTransform> =
      createRscCssCompilerTransforms({
        loadCssExpression: 'import.meta.viteRsc.loadCss()',
      })

    const code = `
      import { renderServerComponent } from '@tanstack/react-start/rsc'
      export const renderable = renderServerComponent(<Card />)
    `

    expect(detectKindsInCode(code, 'server', { compilerTransforms }))
      .toMatchInlineSnapshot(`
      Set {
        "External:react-rsc-render-server-component-css",
      }
    `)
    expect(
      detectKindsInCode(code, 'client', { compilerTransforms }),
    ).toMatchInlineSnapshot(`Set {}`)
  })
})
