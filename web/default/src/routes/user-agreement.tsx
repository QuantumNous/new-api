import { createFileRoute } from '@tanstack/react-router'
import { UserAgreement } from '@/features/legal'

export const Route = createFileRoute('/user-agreement')({
  component: UserAgreement,
})
