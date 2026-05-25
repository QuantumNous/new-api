import { createFileRoute } from '@tanstack/react-router'
import { CodexPage } from '@/features/docs/integration/pages/codex'

export const Route = createFileRoute('/docs/integration/codex')({
  component: CodexPage,
})
