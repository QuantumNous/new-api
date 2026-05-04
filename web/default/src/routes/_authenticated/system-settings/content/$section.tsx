import { createFileRoute, redirect } from '@tanstack/react-router'
import { ContentSettings } from '@/features/system-settings/content'
import {
  CONTENT_DEFAULT_SECTION,
  CONTENT_SECTION_IDS,
} from '@/features/system-settings/content/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/content/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = CONTENT_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/content/$section',
        params: { section: CONTENT_DEFAULT_SECTION },
      })
    }
  },
  component: ContentSettings,
})
