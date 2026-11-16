import { createFileRoute } from '@tanstack/react-router'

import { PlannedProgram } from '@/features/orbit-community'

export const Route = createFileRoute('/requests')({
  component: () => <PlannedProgram program='requests' />,
})
