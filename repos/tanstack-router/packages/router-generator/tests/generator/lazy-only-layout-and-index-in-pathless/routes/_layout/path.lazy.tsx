import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/_layout/path')({
  component: () => 'Path Layout',
})
