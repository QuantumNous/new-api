import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ModelDetails } from '@/features/pricing/components/model-details'

const modelDetailsSearchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  vendor: z.string().optional(),
  group: z.string().optional(),
  quotaType: z.string().optional(),
  endpointType: z.string().optional(),
  tag: z.string().optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  view: z.enum(['card', 'table']).optional().catch(undefined),
  rechargePrice: z.boolean().optional(),
})

export const Route = createFileRoute('/pricing/$modelId/')({
  validateSearch: modelDetailsSearchSchema,
  component: ModelDetails,
})
