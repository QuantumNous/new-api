import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_inner/_deep-index/')({
  component: () => 'Deep Index',
})
