import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { UsageLogs } from '@/features/usage-logs'
import {
  USAGE_LOGS_SECTION_IDS,
  USAGE_LOGS_DEFAULT_SECTION,
} from '@/features/usage-logs/section-registry'

const logTypeValues = ['0', '1', '2', '3', '4', '5'] as const

const usageLogsSearchSchema = z.object({
  section: z
    .enum(USAGE_LOGS_SECTION_IDS as unknown as [string, ...string[]])
    .optional()
    .catch(USAGE_LOGS_DEFAULT_SECTION),
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
})

export const Route = createFileRoute('/_authenticated/usage-logs/')({
  beforeLoad: ({ search }) => {
    if (!search?.section) {
      throw redirect({
        to: '/usage-logs',
        search: { section: USAGE_LOGS_DEFAULT_SECTION },
      })
    }
    // type 仅 common 使用，非 common 时清掉 URL 里的 type
    if (
      search.section !== 'common' &&
      Array.isArray(search.type) &&
      search.type.length > 0
    ) {
      throw redirect({
        to: '/usage-logs',
        search: { ...search, type: undefined },
        replace: true,
      })
    }
  },
  validateSearch: usageLogsSearchSchema,
  component: UsageLogs,
})
