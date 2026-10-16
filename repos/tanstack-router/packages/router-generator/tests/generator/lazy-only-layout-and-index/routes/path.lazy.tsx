import { createLazyFileRoute } from '@tanstack/react-router'
export const Route = createLazyFileRoute('/path')({
  component: () => 'Path Layout',
})
