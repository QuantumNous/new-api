import { createFileRoute, redirect } from '@tanstack/react-router'
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
    beforeLoad: ({ search }) => {
      // 如果没有 section 参数，重定向到带默认 section 的 URL
      if (!search?.section) {
        throw redirect({
          to: '/system-settings/general',
          search: { section: GENERAL_DEFAULT_SECTION },
        })
      }
    },
    component: GeneralSettings,
  }
)
