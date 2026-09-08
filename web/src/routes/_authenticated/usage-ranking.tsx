import { createFileRoute, redirect } from '@tanstack/react-router'
import { UsageRanking } from '@/features/usage-ranking'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
export const Route = createFileRoute('/_authenticated/usage-ranking')({ beforeLoad: ({ location }) => { if (useAuthStore.getState().auth.user?.role !== ROLE.SUPER_ADMIN) throw redirect({ to: '/403', search: { redirect: location.href } }) }, component: UsageRanking })
