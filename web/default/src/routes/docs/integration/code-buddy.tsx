import { createFileRoute } from '@tanstack/react-router'
import { CodeBuddyPage } from '@/features/docs/integration/pages/code-buddy'

export const Route = createFileRoute('/docs/integration/code-buddy')({
  component: CodeBuddyPage,
})
