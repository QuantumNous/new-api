import { createFileRoute } from '@tanstack/react-router'
import { ClaudeCodePage } from '@/features/docs/integration/pages/claude-code'

export const Route = createFileRoute('/docs/integration/claude-code')({
  component: ClaudeCodePage,
})
