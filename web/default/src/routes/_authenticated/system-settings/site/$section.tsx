import { createFileRoute, redirect } from '@tanstack/react-router'
import { SiteSettings } from '@/features/system-settings/site'
import {
  SITE_DEFAULT_SECTION,
  SITE_SECTION_IDS,
} from '@/features/system-settings/site/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/site/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = SITE_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/site/$section',
        params: { section: SITE_DEFAULT_SECTION },
      })
    }
  },
  component: SiteSettings,
})
