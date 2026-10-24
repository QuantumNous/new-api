import { createLazyFileRoute } from '@tanstack/react-router'
export const Route = createLazyFileRoute('/sub')({
  component: () => 'Sub Layout',
})
