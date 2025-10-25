import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Pricing } from '@/features/pricing'

const pricingSearchSchema = z.object({
  search: z.string().optional(),
})

export const Route = createFileRoute('/pricing/')({
  validateSearch: pricingSearchSchema,
  component: Pricing,
})
