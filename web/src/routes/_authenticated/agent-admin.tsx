import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentAdmin } from '@/features/agent-admin'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
export const Route = createFileRoute('/_authenticated/agent-admin')({ beforeLoad: ({ location }) => { const role = useAuthStore.getState().auth.user?.role; if (role !== ROLE.ADMIN && role !== ROLE.SUPER_ADMIN) throw redirect({ to: '/403', search: { redirect: location.href } }) }, component: () => <AgentAdmin search={{ tab: 'agents', p: 1 }} onSearchChange={() => undefined} /> })
