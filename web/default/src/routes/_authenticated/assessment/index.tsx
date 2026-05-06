import { createFileRoute } from '@tanstack/react-router'
import { AssessmentPage } from '@/features/assessment'

export const Route = createFileRoute('/_authenticated/assessment')({
  component: AssessmentPage,
})
