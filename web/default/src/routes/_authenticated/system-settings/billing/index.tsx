import { createFileRoute, redirect } from '@tanstack/react-router'
import { BILLING_DEFAULT_SECTION } from '@/features/system-settings/billing/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/billing/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/billing/$section',
      params: { section: BILLING_DEFAULT_SECTION },
    })
  },
})
