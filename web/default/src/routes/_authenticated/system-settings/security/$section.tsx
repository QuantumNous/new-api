import { createFileRoute, redirect } from '@tanstack/react-router'
import { SecuritySettings } from '@/features/system-settings/security'
import {
  SECURITY_DEFAULT_SECTION,
  SECURITY_SECTION_IDS,
} from '@/features/system-settings/security/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/security/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = SECURITY_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/security/$section',
        params: { section: SECURITY_DEFAULT_SECTION },
      })
    }
  },
  component: SecuritySettings,
})
