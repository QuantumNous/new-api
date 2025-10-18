import { createFileRoute } from '@tanstack/react-router'
import { ModelSettings } from '@/features/system-settings/models'

export const Route = createFileRoute('/_authenticated/system-settings/models')({
  component: ModelSettings,
})
