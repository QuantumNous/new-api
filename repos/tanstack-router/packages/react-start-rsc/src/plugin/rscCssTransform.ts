import type {
  StartCompilerImportTransform,
  StartCompilerTransformContext,
} from '@tanstack/start-plugin-core'

const TSS_SERVERFN_SPLIT_PARAM = 'tss-serverfn-split'
const RSC_CSS_OPTIONS_KEY = '__tanstackStartRscCss'

type BabelTypes = StartCompilerTransformContext['types']
type BabelExpression = ReturnType<
  StartCompilerTransformContext['parseExpression']
>

type RscCssTransformKind =
  | 'renderServerComponent'
  | 'createCompositeComponent'
  | 'renderToReadableStream'

export function createRscCssCompilerTransforms(opts: {
  loadCssExpression: string
  serverFnProviderOnly?: boolean | undefined
}): Array<StartCompilerImportTransform> {
  let loadCssExpression: BabelExpression | undefined

  const getLoadCssExpression = (context: StartCompilerTransformContext) => {
    loadCssExpression ??= context.parseExpression(opts.loadCssExpression)
    return loadCssExpression
  }

  return [
    createRscCssCompilerTransform({
      serverFnProviderOnly: opts.serverFnProviderOnly,
      getLoadCssExpression,
      kind: 'renderServerComponent',
      name: 'react-rsc-render-server-component-css',
    }),
    createRscCssCompilerTransform({
      serverFnProviderOnly: opts.serverFnProviderOnly,
      getLoadCssExpression,
      kind: 'createCompositeComponent',
      name: 'react-rsc-create-composite-component-css',
    }),
    createRscCssCompilerTransform({
      serverFnProviderOnly: opts.serverFnProviderOnly,
      getLoadCssExpression,
      kind: 'renderToReadableStream',
      name: 'react-rsc-render-to-readable-stream-css',
    }),
  ]
}

function createRscCssCompilerTransform(opts: {
  name: string
  kind: RscCssTransformKind
  getLoadCssExpression: (
    context: StartCompilerTransformContext,
  ) => BabelExpression
  serverFnProviderOnly?: boolean | undefined
}): StartCompilerImportTransform {
  return {
    name: opts.name,
    environment: 'server',
    imports: [
      {
        libName: '@tanstack/react-start/rsc',
        rootExport: opts.kind,
      },
      {
        libName: '@tanstack/react-start-rsc',
        rootExport: opts.kind,
      },
    ],
    detect: new RegExp(`\\b${opts.kind}\\b`),
    transform: (candidates, context) => {
      if (
        opts.serverFnProviderOnly &&
        !context.id.includes(TSS_SERVERFN_SPLIT_PARAM)
      ) {
        return
      }

      const t = context.types
      const loadCssExpression = opts.getLoadCssExpression(context)
      const cloneLoadCssExpression = () => t.cloneNode(loadCssExpression)

      for (const candidate of candidates) {
        const args = candidate.path.node.arguments
        if (args.length !== 1) continue

        if (opts.kind === 'renderToReadableStream') {
          const firstArg = args[0]
          if (!firstArg || !t.isExpression(firstArg)) continue
          if (!isTopLevelJsx(t, firstArg)) continue

          args[0] = createCssFragment(
            t,
            firstArg,
            cloneLoadCssExpression(),
          ) as typeof firstArg
          continue
        }

        args.push(
          t.objectExpression([
            t.objectProperty(
              t.identifier(RSC_CSS_OPTIONS_KEY),
              cloneLoadCssExpression(),
            ),
          ]),
        )
      }
    },
  }
}

function isTopLevelJsx(t: BabelTypes, expr: BabelExpression): boolean {
  const unwrapped = unwrapTransparentExpression(t, expr)
  return t.isJSXElement(unwrapped) || t.isJSXFragment(unwrapped)
}

function unwrapTransparentExpression(
  t: BabelTypes,
  expr: BabelExpression,
): BabelExpression {
  let current = expr
  while (
    t.isParenthesizedExpression(current) ||
    t.isTSAsExpression(current) ||
    t.isTSSatisfiesExpression(current) ||
    t.isTSTypeAssertion(current) ||
    t.isTSNonNullExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function createCssFragment(
  t: BabelTypes,
  original: BabelExpression,
  loadCssExpression: BabelExpression,
) {
  const unwrapped = unwrapTransparentExpression(t, original)
  return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
    t.jsxExpressionContainer(loadCssExpression),
    t.isJSXElement(unwrapped) || t.isJSXFragment(unwrapped)
      ? unwrapped
      : t.jsxExpressionContainer(original),
  ])
}
