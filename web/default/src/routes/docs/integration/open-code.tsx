import { createFileRoute } from '@tanstack/react-router'
import { OpenCodePage } from '@/features/docs/integration/pages/open-code'

export const Route = createFileRoute('/docs/integration/open-code')({
  component: OpenCodePage,
})
