import { createFileRoute, redirect } from '@tanstack/react-router'
import { COMMISSION_DEFAULT_SECTION } from '@/features/system-settings/commission/section-registry'

export const Route = createFileRoute('/_authenticated/system-settings/commission/')({
  beforeLoad: () => {
    throw redirect({ to: '/system-settings/commission/$section', params: { section: COMMISSION_DEFAULT_SECTION } })
  },
})
