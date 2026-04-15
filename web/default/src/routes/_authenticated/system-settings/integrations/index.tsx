import { createFileRoute, redirect } from '@tanstack/react-router'
import { INTEGRATIONS_DEFAULT_SECTION } from '@/features/system-settings/integrations/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/integrations/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/integrations/$section',
      params: { section: INTEGRATIONS_DEFAULT_SECTION },
    })
  },
})
