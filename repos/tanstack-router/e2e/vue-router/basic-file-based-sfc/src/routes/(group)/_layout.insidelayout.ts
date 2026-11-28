import { createFileRoute } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(group)/_layout/insidelayout')({
  validateSearch: z.object({ hello: z.string().optional() }),
})
