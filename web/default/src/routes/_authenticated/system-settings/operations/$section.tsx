import { createFileRoute, redirect } from '@tanstack/react-router'
import { OperationsSettings } from '@/features/system-settings/operations'
import {
  OPERATIONS_DEFAULT_SECTION,
  OPERATIONS_SECTION_IDS,
} from '@/features/system-settings/operations/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/operations/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = OPERATIONS_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/operations/$section',
        params: { section: OPERATIONS_DEFAULT_SECTION },
      })
    }
  },
  component: OperationsSettings,
})
