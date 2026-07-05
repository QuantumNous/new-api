import { createFileRoute, redirect } from '@tanstack/react-router'
import { CommissionSettings } from '@/features/system-settings/commission'
import { COMMISSION_DEFAULT_SECTION, COMMISSION_SECTION_IDS } from '@/features/system-settings/commission/section-registry'

export const Route = createFileRoute('/_authenticated/system-settings/commission/$section')({
  beforeLoad: ({ params }) => {
    const validSections = COMMISSION_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({ to: '/system-settings/commission/$section', params: { section: COMMISSION_DEFAULT_SECTION } })
    }
  },
  component: CommissionSettings,
})
