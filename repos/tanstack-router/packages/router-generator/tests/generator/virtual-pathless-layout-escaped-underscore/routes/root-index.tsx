import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_root-index/')({
  component: () => 'Root Index',
})
