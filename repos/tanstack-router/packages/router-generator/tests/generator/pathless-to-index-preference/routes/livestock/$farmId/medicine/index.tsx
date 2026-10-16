import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/livestock/$farmId/medicine/')({
  component: () => <div>Medicine index</div>,
})
