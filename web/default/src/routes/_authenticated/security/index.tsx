/*
Copyright (C) 2023-2026 QuantumNous

This program is free software...
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { SecurityDashboardPage } from '@/features/security/pages/dashboard-page'

export const Route = createFileRoute('/_authenticated/security/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: SecurityDashboardPage,
})
