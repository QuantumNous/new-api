import { createFileRoute } from '@tanstack/react-router'
import { CustomPage } from '@/features/custom-page'

export const Route = createFileRoute('/custom/')({
  component: CustomPage,
})
