import { createFileRoute, redirect } from '@tanstack/react-router'
import { GeneralSettings } from '@/features/system-settings/general'
import {
  GENERAL_DEFAULT_SECTION,
  GENERAL_SECTION_IDS,
} from '@/features/system-settings/general/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/general/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = GENERAL_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/general/$section',
        params: { section: GENERAL_DEFAULT_SECTION },
      })
    }
  },
  component: GeneralSettings,
})
