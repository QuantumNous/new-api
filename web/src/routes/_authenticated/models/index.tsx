import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Models } from '@/features/models'

const modelsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/models/')({
  validateSearch: modelsSearchSchema,
  component: Models,
})
