import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pathless-layout/_layout/child')({
  component: () => (
    <div data-testid="pathless-layout-child">Pathless Layout Child Route</div>
  ),
})
