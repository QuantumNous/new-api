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

import { UsageLogs } from '@/features/usage-logs'
import {
  isUsageLogsSectionId,
  USAGE_LOGS_DEFAULT_SECTION,
} from '@/features/usage-logs/section-registry'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { usageLogsSearchSchema } from '../../usage-logs/$section'

function SiteUsageLogsPage() {
  const { section } = Route.useParams()
  const searchParams = Route.useSearch()
  return (
    <UsageLogs mode='site' section={section} searchParams={searchParams} />
  )
}

export const Route = createFileRoute(
  '/_authenticated/admin/usage-logs/$section'
)({
  beforeLoad: ({ params, search }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }

    if (!isUsageLogsSectionId(params.section)) {
      throw redirect({
        to: '/admin/usage-logs/$section',
        params: { section: USAGE_LOGS_DEFAULT_SECTION },
      })
    }

    const hasTypeSearch = Array.isArray(search?.type)
      ? search.type.length > 0
      : search?.type != null && search.type !== ''
    if (params.section !== 'common' && hasTypeSearch) {
      throw redirect({
        to: '/admin/usage-logs/$section',
        params: { section: params.section },
        search: { ...search, type: undefined },
        replace: true,
      })
    }
  },
  validateSearch: usageLogsSearchSchema,
  component: SiteUsageLogsPage,
})
