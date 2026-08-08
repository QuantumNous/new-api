import { createFileRoute } from '@tanstack/react-router'
import { Commission } from '@/features/commission'

export const Route = createFileRoute('/_authenticated/commission/')({
  component: Commission,
})
