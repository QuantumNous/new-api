import { createFileRoute } from '@tanstack/react-router'
import { ContentSettings } from '@/features/system-settings/content'

export const Route = createFileRoute('/_authenticated/system-settings/content')(
  {
    component: ContentSettings,
  }
)
