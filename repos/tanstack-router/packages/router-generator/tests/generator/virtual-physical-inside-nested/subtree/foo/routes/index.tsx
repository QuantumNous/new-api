import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/s1/_layout/foo/')({
  component: () => <div>Nested home</div>,
})
