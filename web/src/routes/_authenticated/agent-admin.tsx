import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentAdmin } from '@/features/agent-admin'
import { agentAdminSearchSchema } from '@/features/agent-admin/lib/admin'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
export const Route = createFileRoute('/_authenticated/agent-admin')({ validateSearch: agentAdminSearchSchema, beforeLoad: ({ location }) => { const role = useAuthStore.getState().auth.user?.role; if (role !== ROLE.ADMIN && role !== ROLE.SUPER_ADMIN) throw redirect({ to: '/403', search: { redirect: location.href } }) }, component: AgentAdminRoute })
function AgentAdminRoute() { const search = Route.useSearch(); const navigate = Route.useNavigate(); return <AgentAdmin search={search} onSearchChange={(updates) => { void navigate({ search: (prev) => ({ ...prev, ...updates }) }) }} /> }
