import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { ModelQuotaRulesPage } from '@/features/model-quota/model-quota-rules-page'

export const Route = createFileRoute('/_authenticated/model-quota-rules/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: ModelQuotaRulesPage,
})
