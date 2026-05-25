import { createFileRoute } from '@tanstack/react-router'
import { IntegrationHome } from '@/features/docs/integration'

export const Route = createFileRoute('/docs/integration/')({
  component: IntegrationHome,
})
