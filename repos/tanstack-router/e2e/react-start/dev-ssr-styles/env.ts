import { z } from 'zod'

const ssrStylesModeSchema = z
  .enum(['default', 'disabled', 'custom-basepath'])
  .default('default')

export type SsrStylesMode = z.infer<typeof ssrStylesModeSchema>

export const ssrStylesMode: SsrStylesMode = ssrStylesModeSchema.parse(
  process.env.SSR_STYLES,
)

export const useNitro = process.env.VITE_USE_NITRO === 'true'
export const viteBundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'
