import { createFileRoute } from '@tanstack/react-router'

import { PlannedProgram } from '@/features/orbit-community'

export const Route = createFileRoute('/student-verification')({
  component: () => <PlannedProgram program='students' />,
})
