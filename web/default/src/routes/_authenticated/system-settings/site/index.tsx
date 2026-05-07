import { createFileRoute, redirect } from '@tanstack/react-router'
import { SITE_DEFAULT_SECTION } from '@/features/system-settings/site/section-registry.tsx'

export const Route = createFileRoute('/_authenticated/system-settings/site/')({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/site/$section',
      params: { section: SITE_DEFAULT_SECTION },
    })
  },
})
