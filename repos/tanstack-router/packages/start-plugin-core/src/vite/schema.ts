import { z } from 'zod'
import {
  parseStartConfig as parseCoreStartConfig,
  tanstackStartOptionsObjectSchema,
} from '../schema'
import type { CompileStartFrameworkOptions } from '../types'
import type { InlineCssInputOptions } from '../schema'

export const tanstackStartViteOptionsSchema = tanstackStartOptionsObjectSchema
  .extend({
    vite: z
      .object({ installDevServerMiddleware: z.boolean().optional() })
      .optional(),
  })
  .optional()
  .prefault({})

export function parseStartConfig(
  opts: z.input<typeof tanstackStartViteOptionsSchema>,
  corePluginOpts: { framework: CompileStartFrameworkOptions },
  root: string,
) {
  tanstackStartViteOptionsSchema.parse(opts)
  const { vite: _vite, ...coreOptions } = opts ?? {}

  return parseCoreStartConfig(coreOptions, corePluginOpts, root)
}

export type TanStackStartViteInputConfig = z.input<
  typeof tanstackStartViteOptionsSchema
> & {
  server?: {
    build?: {
      inlineCss?: InlineCssInputOptions
    }
  }
}
