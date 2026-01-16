import { createFileRoute } from '@tanstack/react-router'
import { GeneralSettings } from '@/features/system-settings/general'
import {
  GENERAL_DEFAULT_SECTION,
  GENERAL_SECTION_IDS,
} from '@/features/system-settings/general/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const generalSearchSchema = createSectionSearchSchema(
  GENERAL_SECTION_IDS,
  GENERAL_DEFAULT_SECTION
)

export const Route = createFileRoute('/_authenticated/system-settings/general')(
  {
    validateSearch: generalSearchSchema,
    component: GeneralSettings,
  }
)
