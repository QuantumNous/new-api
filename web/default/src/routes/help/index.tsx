import { createFileRoute } from '@tanstack/react-router'
import { HelpCenterPage } from '@/features/help-center'

export const Route = createFileRoute('/help/')({
  component: HelpCenterPage,
})
