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
/**
 * Hook for checking whether the current user should see group controls.
 *
 * PLG users have the group concept hidden everywhere in their UI; their API
 * keys are always forced to the `plg` group by the backend. Enterprise identity
 * is derived from the user's group; the legacy is_enterprise field is only a
 * compatibility payload from older sessions.
 */
import { useAuthStore } from '@/stores/auth-store'

const ADMIN_ROLE = 10
const PLG_GROUP = 'plg'
const LEGACY_DEFAULT_GROUP = 'default'

function normalizeIdentityGroup(group: string | undefined): string {
  const normalized = group?.trim()
  if (!normalized || normalized === LEGACY_DEFAULT_GROUP) return PLG_GROUP
  return normalized
}

/**
 * Returns true when the current user should see group controls.
 */
export function useIsEnterprise(): boolean {
  return useAuthStore((state) => {
    const user = state.auth.user
    if (!user) return false
    if (user.role >= ADMIN_ROLE) return true
    return normalizeIdentityGroup(user.group) !== PLG_GROUP
  })
}
