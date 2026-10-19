/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { PartnerOAuthAuthorizationLogs } from '@/features/partner-oauth-clients/authorization-logs'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute(
  '/_authenticated/partner-oauth-clients/logs'
)({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (
      !auth.user ||
      auth.user.role < ROLE.ADMIN ||
      !hasPermission(
        auth.user,
        ADMIN_PERMISSION_RESOURCES.PARTNER_OAUTH_CLIENT,
        ADMIN_PERMISSION_ACTIONS.READ
      )
    ) {
      throw redirect({ to: '/403' })
    }
  },
  component: PartnerOAuthAuthorizationLogs,
})
