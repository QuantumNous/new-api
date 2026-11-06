import { createLazyFileRoute } from '@tanstack/react-router'
export const Route = createLazyFileRoute('/sub/test')({
  component: () => 'Test Route',
})
