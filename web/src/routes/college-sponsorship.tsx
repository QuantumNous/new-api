import { createFileRoute } from '@tanstack/react-router'

import { PlannedProgram } from '@/features/orbit-community'

export const Route = createFileRoute('/college-sponsorship')({
  component: () => <PlannedProgram program='sponsorship' />,
})
