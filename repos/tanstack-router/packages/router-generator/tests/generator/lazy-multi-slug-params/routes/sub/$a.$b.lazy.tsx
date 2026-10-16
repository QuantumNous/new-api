import { createLazyFileRoute } from '@tanstack/react-router'
export const Route = createLazyFileRoute('/sub/$a/$b')({
  component: () => 'Multi Slug Route',
})
