import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { MODELS_DEFAULT_SECTION } from '@/features/models/section-registry'

export const Route = createFileRoute('/_authenticated/models/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }

    throw redirect({
      to: '/models/$section',
      params: { section: MODELS_DEFAULT_SECTION },
    })
  },
})
