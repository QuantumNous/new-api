import { createFileRoute } from '@tanstack/react-router'
import { About } from '@/features/about'

export const Route = createFileRoute('/about/')({
  component: About,
})
