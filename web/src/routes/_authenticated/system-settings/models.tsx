import { createFileRoute } from '@tanstack/react-router'
import { ModelSettings } from '@/features/system-settings/models'
import {
  MODELS_DEFAULT_SECTION,
  MODELS_SECTION_IDS,
} from '@/features/system-settings/models/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const modelsSearchSchema = createSectionSearchSchema(
  MODELS_SECTION_IDS,
  MODELS_DEFAULT_SECTION
)

export const Route = createFileRoute('/_authenticated/system-settings/models')({
  validateSearch: modelsSearchSchema,
  component: ModelSettings,
})
