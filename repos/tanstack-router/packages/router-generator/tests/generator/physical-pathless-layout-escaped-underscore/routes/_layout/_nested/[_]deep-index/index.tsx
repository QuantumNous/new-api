import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_nested/_deep-index/')({
  component: () => 'Deep Index',
})
