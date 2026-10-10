import { z } from 'zod'
import {
  configSchema as generatorConfigSchema,
  getConfig as getGeneratorConfig,
} from '@tanstack/router-generator'
import type {
  CreateFileRoute,
  RegisteredRouter,
  RouteIds,
} from '@tanstack/router-core'
import type { CodeSplitGroupings } from './constants'
import type { ReferenceRouteCompilerPlugin } from './code-splitter/plugins'

export const splitGroupingsSchema = z
  .array(
    z.array(
      z.union([
        z.literal('loader'),
        z.literal('component'),
        z.literal('pendingComponent'),
        z.literal('errorComponent'),
        z.literal('notFoundComponent'),
      ]),
    ),
    {
      message:
        "  Must be an Array of Arrays containing the split groupings. i.e. [['component'], ['pendingComponent'], ['errorComponent', 'notFoundComponent']]",
    },
  )
  .superRefine((val, ctx) => {
    const flattened = val.flat()
    const unique = [...new Set(flattened)]

    // Elements must be unique,
    // ie. this shouldn't be allows [['component'], ['component', 'loader']]
    if (unique.length !== flattened.length) {
      ctx.addIssue({
        code: 'custom',
        message:
          "  Split groupings must be unique and not repeated. i.e. i.e. [['component'], ['pendingComponent'], ['errorComponent', 'notFoundComponent']]." +
          `\n  You input was: ${JSON.stringify(val)}.`,
      })
    }
  })

export type CodeSplittingOptions = {
  /**
   * Use this function to programmatically control the code splitting behavior
   * based on the `routeId` for each route.
   *
   * If you just need to change the default behavior, you can use the `defaultBehavior` option.
   * @param params
   */
  splitBehavior?: (params: {
    routeId: RouteIds<RegisteredRouter['routeTree']>
  }) => CodeSplitGroupings | undefined | void

  /**
   * The default/global configuration to control your code splitting behavior per route.
   * @default [['component'],['pendingComponent'],['errorComponent'],['notFoundComponent']]
   */
  defaultBehavior?: CodeSplitGroupings

  /**
   * The nodes that shall be deleted from the route.
   * @default undefined
   */
  deleteNodes?: Array<DeletableNodes>

  /**
   * @default true
   */
  addHmr?: boolean

  /**
   * Internal compiler plugins used by framework integrations.
   * @internal
   */
  compilerPlugins?: Array<ReferenceRouteCompilerPlugin>
}

export type HmrStyle = 'vite' | 'webpack'

export type HmrOptions = {
  /**
   * Selects the HMR runtime style to emit code for.
   * - `'vite'` (default): ESM `import.meta.hot` with Vite accept-callback semantics.
   * - `'webpack'`: `import.meta.webpackHot` with webpack / Rspack `module.hot` re-execution semantics.
   *
   * Bundler-specific plugin entries (e.g. `rspack.ts`, `webpack.ts`) set this explicitly.
   */
  style?: HmrStyle
}

const codeSplittingOptionsSchema = z.object({
  splitBehavior: z
    .custom<
      CodeSplittingOptions['splitBehavior']
    >((value) => typeof value === 'function')
    .optional(),
  defaultBehavior: splitGroupingsSchema.optional(),
  deleteNodes: z.array(z.string()).optional(),
  addHmr: z.boolean().optional().default(true),
})

type FileRouteKeys = keyof (Parameters<
  CreateFileRoute<any, any, any, any, any>
>[0] & {})
export type DeletableNodes = FileRouteKeys | (string & {})

export const configSchema = generatorConfigSchema.extend({
  enableRouteGeneration: z.boolean().optional(),
  codeSplittingOptions: z
    .custom<CodeSplittingOptions>((v) => {
      return codeSplittingOptionsSchema.parse(v)
    })
    .optional(),
  plugin: z
    .object({
      hmr: z
        .object({
          style: z.enum(['vite', 'webpack']).optional(),
        })
        .optional(),
      vite: z
        .object({
          environmentName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

export const getConfig = (inlineConfig: Partial<Config>, root: string) => {
  const config = getGeneratorConfig(inlineConfig, root)

  return configSchema.parse({ ...inlineConfig, ...config })
}

export type Config = z.infer<typeof configSchema>
export type ConfigInput = z.input<typeof configSchema>
export type ConfigOutput = z.output<typeof configSchema>
