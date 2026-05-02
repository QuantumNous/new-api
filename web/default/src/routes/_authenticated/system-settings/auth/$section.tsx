import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthSettings } from '@/features/system-settings/auth'
import {
  AUTH_DEFAULT_SECTION,
  AUTH_SECTION_IDS,
} from '@/features/system-settings/auth/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/auth/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = AUTH_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/auth/$section',
        params: { section: AUTH_DEFAULT_SECTION },
      })
    }
  },
  component: AuthSettings,
})
