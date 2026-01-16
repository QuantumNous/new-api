import { createFileRoute } from '@tanstack/react-router'
import { ContentSettings } from '@/features/system-settings/content'
import {
  CONTENT_DEFAULT_SECTION,
  CONTENT_SECTION_IDS,
} from '@/features/system-settings/content/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const contentSearchSchema = createSectionSearchSchema(
  CONTENT_SECTION_IDS,
  CONTENT_DEFAULT_SECTION
)

export const Route = createFileRoute('/_authenticated/system-settings/content')(
  {
    validateSearch: contentSearchSchema,
    component: ContentSettings,
  }
)
