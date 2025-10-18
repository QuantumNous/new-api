import { createFileRoute } from '@tanstack/react-router'
import { AuthSettings } from '@/features/system-settings/auth'

export const Route = createFileRoute('/_authenticated/system-settings/auth')({
  component: AuthSettings,
})
