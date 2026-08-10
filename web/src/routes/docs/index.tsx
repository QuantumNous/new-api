import { createFileRoute } from '@tanstack/react-router'

import { DocHome } from '@/features/docs/pages/doc-home'

export const Route = createFileRoute('/docs/')({
  component: DocHome,
})
