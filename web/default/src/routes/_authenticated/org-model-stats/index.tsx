import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { UserModelStatsPage } from '@/features/user-model-stats'

export const Route = createFileRoute('/_authenticated/org-model-stats/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  component: () => <UserModelStatsPage accountType={1} />,
})
