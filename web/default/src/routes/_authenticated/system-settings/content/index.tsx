import { createFileRoute, redirect } from '@tanstack/react-router'
import { CONTENT_DEFAULT_SECTION } from '@/features/system-settings/content/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/content/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/content/$section',
      params: { section: CONTENT_DEFAULT_SECTION },
    })
  },
})
