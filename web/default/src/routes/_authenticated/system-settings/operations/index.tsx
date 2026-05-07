import { createFileRoute, redirect } from '@tanstack/react-router'
import { OPERATIONS_DEFAULT_SECTION } from '@/features/system-settings/operations/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/operations/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/operations/$section',
      params: { section: OPERATIONS_DEFAULT_SECTION },
    })
  },
})
