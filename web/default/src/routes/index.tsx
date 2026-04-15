import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/home'

export const Route = createFileRoute('/')({
  component: Home,
})
