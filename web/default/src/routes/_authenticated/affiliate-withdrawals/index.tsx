import { createFileRoute, redirect } from '@tanstack/react-router'

import { AffiliateWithdrawals } from '@/features/affiliate-withdrawals'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/affiliate-withdrawals/')({
  beforeLoad: () => {
    const auth = useAuthStore.getState().auth
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: AffiliateWithdrawals,
})
