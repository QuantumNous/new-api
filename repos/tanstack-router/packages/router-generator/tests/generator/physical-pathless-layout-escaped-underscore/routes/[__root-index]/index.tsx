import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__root-index/')({
  component: () => 'Double Root Index',
})
