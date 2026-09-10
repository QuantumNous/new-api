/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { AgentAdmin } from '@/features/agent-admin'
import { agentAdminSearchSchema } from '@/features/agent-admin/lib/admin'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/agent-admin')({
  validateSearch: agentAdminSearchSchema,
  beforeLoad: ({ location }) => {
    const role = useAuthStore.getState().auth.user?.role
    if (role !== ROLE.ADMIN && role !== ROLE.SUPER_ADMIN) {
      throw redirect({ to: '/403', search: { redirect: location.href } })
    }
  },
  component: AgentAdminRoute,
})

function AgentAdminRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AgentAdmin
      search={search}
      onSearchChange={(updates) => {
        void navigate({ search: (prev) => ({ ...prev, ...updates }) })
      }}
    />
  )
}
