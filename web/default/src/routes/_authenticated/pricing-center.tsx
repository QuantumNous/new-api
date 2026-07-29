/* Copyright (C) 2023-2026 QuantumNous */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { PricingCenter } from '@/features/pricing-center'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/pricing-center')({
  validateSearch: z.object({ model: z.string().optional() }),
  beforeLoad: () => {
    if (useAuthStore.getState().auth.user?.role !== ROLE.SUPER_ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: PricingCenterRoute,
})

function PricingCenterRoute() {
  const search = Route.useSearch()
  return <PricingCenter initialModelFilter={search.model} />
}
