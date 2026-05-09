import { createFileRoute, redirect } from '@tanstack/react-router'
import { BillingSettings } from '@/features/system-settings/billing'
import {
  BILLING_DEFAULT_SECTION,
  BILLING_SECTION_IDS,
} from '@/features/system-settings/billing/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/billing/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = BILLING_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/billing/$section',
        params: { section: BILLING_DEFAULT_SECTION },
      })
    }
  },
  component: BillingSettings,
})
