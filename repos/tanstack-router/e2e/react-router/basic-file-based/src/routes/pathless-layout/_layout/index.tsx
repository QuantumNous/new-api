import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pathless-layout/_layout/')({
  component: () => (
    <div data-testid="pathless-layout-index">Pathless Layout Index</div>
  ),
})
