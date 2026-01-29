import { createFileRoute, redirect } from '@tanstack/react-router'
import { USAGE_LOGS_DEFAULT_SECTION } from '@/features/usage-logs/section-registry'

export const Route = createFileRoute('/_authenticated/usage-logs/')({
  beforeLoad: () => {
    throw redirect({
      to: '/usage-logs/$section',
      params: { section: USAGE_LOGS_DEFAULT_SECTION },
    })
  },
})
