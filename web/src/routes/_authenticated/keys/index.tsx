import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ApiKeys } from '@/features/keys'
import { apiKeyStatuses } from '@/features/keys/data/data'

const apiKeySearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(z.enum(apiKeyStatuses.map((s) => String(s.value) as `${number}`)))
    .optional()
    .catch([]),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/keys/')({
  validateSearch: apiKeySearchSchema,
  component: ApiKeys,
})
