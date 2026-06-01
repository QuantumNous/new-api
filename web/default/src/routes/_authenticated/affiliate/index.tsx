import { createFileRoute } from '@tanstack/react-router'
import { AffiliatePage } from '@/features/affiliate'

export const Route = createFileRoute('/_authenticated/affiliate/')({
  component: AffiliatePage,
})
