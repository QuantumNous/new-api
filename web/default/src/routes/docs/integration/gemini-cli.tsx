import { createFileRoute } from '@tanstack/react-router'
import { GeminiCliPage } from '@/features/docs/integration/pages/gemini-cli'

export const Route = createFileRoute('/docs/integration/gemini-cli')({
  component: GeminiCliPage,
})
