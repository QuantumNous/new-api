import { createFileRoute } from '@tanstack/react-router'
import { AuthSettings } from '@/features/system-settings/auth'
import {
  AUTH_DEFAULT_SECTION,
  AUTH_SECTION_IDS,
} from '@/features/system-settings/auth/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const authSearchSchema = createSectionSearchSchema(
  AUTH_SECTION_IDS,
  AUTH_DEFAULT_SECTION
)

export const Route = createFileRoute('/_authenticated/system-settings/auth')({
  validateSearch: authSearchSchema,
  component: AuthSettings,
})
