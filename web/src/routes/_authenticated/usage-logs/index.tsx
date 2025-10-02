import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { UsageLogs } from '@/features/usage-logs'

const logTypeValues = ['0', '1', '2', '3', '4', '5'] as const
const logCategoryValues = ['common', 'drawing', 'task'] as const

const usageLogsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  type: z.array(z.enum(logTypeValues)).optional().catch([]),
  filter: z.string().optional().catch(''),
  model: z.string().optional().catch(''),
  token: z.string().optional().catch(''),
  channel: z.string().optional().catch(''),
  group: z.string().optional().catch(''),
  username: z.string().optional().catch(''),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  tab: z.enum(logCategoryValues).optional().catch('common'),
})

export const Route = createFileRoute('/_authenticated/usage-logs/')({
  validateSearch: usageLogsSearchSchema,
  component: UsageLogs,
})
