import { createFileRoute } from '@tanstack/react-router'
import { Docs } from '@/features/docs'

export const Route = createFileRoute('/docs/')({
  component: Docs,
})
