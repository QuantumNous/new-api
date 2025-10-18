import { createFileRoute } from '@tanstack/react-router'
import { IntegrationSettings } from '@/features/system-settings/integrations'

export const Route = createFileRoute(
  '/_authenticated/system-settings/integrations'
)({
  component: IntegrationSettings,
})
