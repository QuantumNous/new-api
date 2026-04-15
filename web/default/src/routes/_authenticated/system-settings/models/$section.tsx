import { createFileRoute, redirect } from '@tanstack/react-router'
import { ModelSettings } from '@/features/system-settings/models'
import {
  MODELS_DEFAULT_SECTION,
  MODELS_SECTION_IDS,
} from '@/features/system-settings/models/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/models/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = MODELS_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/models/$section',
        params: { section: MODELS_DEFAULT_SECTION },
      })
    }
  },
  component: ModelSettings,
})
