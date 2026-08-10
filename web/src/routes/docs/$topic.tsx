import { createFileRoute } from '@tanstack/react-router'

import { DocTopicPage } from '@/features/docs/pages/doc-topic'

export const Route = createFileRoute('/docs/$topic')({
  component: DocTopicPage,
})
