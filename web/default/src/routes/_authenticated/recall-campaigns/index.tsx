import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { RecallCampaigns } from '@/features/recall-campaigns'

export const Route = createFileRoute('/_authenticated/recall-campaigns/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN)
      throw redirect({ to: '/403' })
  },
  component: RecallCampaigns,
})
