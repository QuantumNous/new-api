import { z } from 'zod'

export const ssrSchema = z
  .object({
    ssr: z.union([z.literal('data-only'), z.boolean()]).optional(),
    expected: z
      .object({
        data: z.union([z.literal('client'), z.literal('server')]),
        render: z.union([
          z.literal('client-only'),
          z.literal('server-and-client'),
        ]),
      })
      .optional(),
  })
  .optional()
