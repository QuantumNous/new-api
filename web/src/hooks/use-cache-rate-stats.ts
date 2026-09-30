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
import { useSystemConfigStore } from '@/stores/system-config-store'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'

/**
 * Whether cache rate stats should be rendered for the current viewer.
 *
 * The admin toggle hides all cache rate UI globally; the user visibility
 * toggle additionally hides it from common users (admins/root always pass).
 * Undefined values (status not yet loaded) fall back to the backend defaults.
 */
export function useCacheRateStatsVisible(): boolean {
  const cacheRateStatsEnabled = useSystemConfigStore(
    (s) => s.config.cacheRateStatsEnabled
  )
  const cacheRateUserVisibleEnabled = useSystemConfigStore(
    (s) => s.config.cacheRateUserVisibleEnabled
  )
  const role = useAuthStore((state) => state.auth.user?.role)
  const isAdmin = role != null && role >= ROLE.ADMIN

  if (cacheRateStatsEnabled === false) return false
  if (isAdmin) return true
  return cacheRateUserVisibleEnabled !== false
}
