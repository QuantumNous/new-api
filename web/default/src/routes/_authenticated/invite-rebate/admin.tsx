import { createFileRoute, redirect } from '@tanstack/react-router'

import { InviteRebateAdminPage } from '@/features/invite-rebate'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/invite-rebate/admin')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: InviteRebateAdminPage,
})
