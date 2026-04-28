import { createFileRoute, redirect } from '@tanstack/react-router'
import { GENERAL_DEFAULT_SECTION } from '@/features/system-settings/general/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/general/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/general/$section',
      params: { section: GENERAL_DEFAULT_SECTION },
    })
  },
})
