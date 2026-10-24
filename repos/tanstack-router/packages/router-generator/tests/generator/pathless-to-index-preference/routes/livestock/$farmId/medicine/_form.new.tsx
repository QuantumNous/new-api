import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/livestock/$farmId/medicine/_form/new')({
  component: () => <div>New medicine</div>,
})
