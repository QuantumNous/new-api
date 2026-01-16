import { createFileRoute } from '@tanstack/react-router'
import { IntegrationSettings } from '@/features/system-settings/integrations'
import {
  INTEGRATIONS_DEFAULT_SECTION,
  INTEGRATIONS_SECTION_IDS,
} from '@/features/system-settings/integrations/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const integrationsSearchSchema = createSectionSearchSchema(
  INTEGRATIONS_SECTION_IDS,
  INTEGRATIONS_DEFAULT_SECTION
)

export const Route = createFileRoute(
  '/_authenticated/system-settings/integrations'
)({
  validateSearch: integrationsSearchSchema,
  component: IntegrationSettings,
})
