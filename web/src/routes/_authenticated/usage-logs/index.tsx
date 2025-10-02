import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { UsageLogs } from '@/features/usage-logs'

const logTypeValues = ['0', '1', '2', '3', '4', '5'] as const

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
})

export const Route = createFileRoute('/_authenticated/usage-logs/')({
  validateSearch: usageLogsSearchSchema,
  component: UsageLogs,
  beforeLoad: ({ search }) => {
    // 如果没有时间参数，设置默认时间范围（今天00:00到现在+1小时）
    if (!search.startTime && !search.endTime) {
      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const endTime = new Date(now.getTime() + 3600 * 1000) // +1 hour

      throw redirect({
        to: '/usage-logs',
        search: {
          ...search,
          startTime: todayStart.getTime(),
          endTime: endTime.getTime(),
        },
      })
    }
  },
})
