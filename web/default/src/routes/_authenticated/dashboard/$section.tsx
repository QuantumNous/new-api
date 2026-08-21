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
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Dashboard } from '@/features/dashboard'
import {
  DASHBOARD_SECTION_IDS,
  DASHBOARD_DEFAULT_SECTION,
  isDashboardSectionAllowed,
} from '@/features/dashboard/section-registry'

/**
 * `?model=` hands a model from the model catalog to the overview's integration
 * examples, so the picker there lands pre-selected on the model the user came
 * from. Anything else is dropped rather than echoed back into the URL.
 */
export function validateDashboardSearch(search: Record<string, unknown>): {
  model?: string
} {
  const model = typeof search.model === 'string' ? search.model.trim() : ''
  return model ? { model } : {}
}

export const Route = createFileRoute('/_authenticated/dashboard/$section')({
  validateSearch: validateDashboardSearch,
  beforeLoad: ({ params }) => {
    const validSections = DASHBOARD_SECTION_IDS as unknown as string[]
    const userRole = useAuthStore.getState().auth.user?.role
    const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)

    if (
      !validSections.includes(params.section) ||
      !isDashboardSectionAllowed(params.section, isAdmin)
    ) {
      throw redirect({
        to: '/dashboard/$section',
        params: { section: DASHBOARD_DEFAULT_SECTION },
      })
    }
  },
  component: Dashboard,
})
