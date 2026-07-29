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

import { Dashboard } from '@/features/dashboard'
import { DASHBOARD_SECTION_IDS } from '@/features/dashboard/section-registry'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const SITE_ANALYTICS_SECTIONS = DASHBOARD_SECTION_IDS.filter(
  (section) => section !== 'overview'
) as string[]

export const Route = createFileRoute(
  '/_authenticated/admin/analytics/$section'
)({
  beforeLoad: ({ params }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }

    if (!SITE_ANALYTICS_SECTIONS.includes(params.section)) {
      throw redirect({
        to: '/admin/analytics/$section',
        params: { section: 'models' },
      })
    }
  },
  component: () => <Dashboard scope='site' />,
})
