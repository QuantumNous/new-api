import { createFileRoute } from '@tanstack/react-router'
import { IntegrationDocsShell } from '@/features/docs/integration/integration-layout'

export const Route = createFileRoute('/docs/integration')({
  component: IntegrationDocsShell,
})
