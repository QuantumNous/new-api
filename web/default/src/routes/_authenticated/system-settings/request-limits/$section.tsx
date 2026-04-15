import { createFileRoute, redirect } from '@tanstack/react-router'
import { RequestLimitsSettings } from '@/features/system-settings/request-limits'
import {
  REQUEST_LIMITS_DEFAULT_SECTION,
  REQUEST_LIMITS_SECTION_IDS,
} from '@/features/system-settings/request-limits/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/request-limits/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = REQUEST_LIMITS_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/request-limits/$section',
        params: { section: REQUEST_LIMITS_DEFAULT_SECTION },
      })
    }
  },
  component: RequestLimitsSettings,
})
