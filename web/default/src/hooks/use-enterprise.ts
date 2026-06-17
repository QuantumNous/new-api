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
 * Hook for checking whether the current user is an enterprise user.
 *
 * Non-enterprise (PLG) users have the group concept hidden everywhere in
 * their UI; their API keys are always forced to the `plg` group by the
 * backend. Enterprise users (and admins, who are backfilled as enterprise)
 * keep the full group UI.
 */
import { useAuthStore } from '@/stores/auth-store'

/**
 * Returns true when the current user is an enterprise user.
 */
export function useIsEnterprise(): boolean {
  return useAuthStore((state) => !!state.auth.user?.is_enterprise)
}
