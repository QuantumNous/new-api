import { createFileRoute, redirect } from '@tanstack/react-router'
import { AUTH_DEFAULT_SECTION } from '@/features/system-settings/auth/section-registry.tsx'

export const Route = createFileRoute('/_authenticated/system-settings/auth/')({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/auth/$section',
      params: { section: AUTH_DEFAULT_SECTION },
    })
  },
})
