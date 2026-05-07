import { createFileRoute, redirect } from '@tanstack/react-router'
import { SECURITY_DEFAULT_SECTION } from '@/features/system-settings/security/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/security/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/security/$section',
      params: { section: SECURITY_DEFAULT_SECTION },
    })
  },
})
