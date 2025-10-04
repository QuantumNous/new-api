import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Redemptions } from '@/features/redemptions'
import { REDEMPTION_STATUS_OPTIONS } from '@/features/redemptions/constants'

const redemptionsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z
    .array(z.enum(REDEMPTION_STATUS_OPTIONS.map((s) => s.value as `${number}`)))
    .optional()
    .catch([]),
})

export const Route = createFileRoute('/_authenticated/redemption-codes/')({
  validateSearch: redemptionsSearchSchema,
  component: Redemptions,
})
