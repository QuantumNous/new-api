import * as z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { GeneralSettings } from '@/features/system-settings/general'
import {
  GENERAL_DEFAULT_SECTION,
  GENERAL_SECTION_IDS,
} from '@/features/system-settings/general/section-registry.tsx'

const generalSearchSchema = z.object({
  section: z
    .enum(GENERAL_SECTION_IDS)
    .optional()
    .catch(GENERAL_DEFAULT_SECTION),
})

export const Route = createFileRoute('/_authenticated/system-settings/general')(
  {
    validateSearch: generalSearchSchema,
    component: GeneralSettings,
  }
)
