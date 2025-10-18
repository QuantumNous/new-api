import { createFileRoute } from '@tanstack/react-router'
import { GeneralSettings } from '@/features/system-settings/general'

export const Route = createFileRoute('/_authenticated/system-settings/general')(
  {
    component: GeneralSettings,
  }
)
