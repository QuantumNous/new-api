import { createFileRoute } from '@tanstack/react-router'
import { TracePage } from '@/features/docs/integration/pages/trace'

export const Route = createFileRoute('/docs/integration/trace')({
  component: TracePage,
})
