import { createFileRoute, redirect } from '@tanstack/react-router'
import { REQUEST_LIMITS_DEFAULT_SECTION } from '@/features/system-settings/request-limits/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/request-limits/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/request-limits/$section',
      params: { section: REQUEST_LIMITS_DEFAULT_SECTION },
    })
  },
})
