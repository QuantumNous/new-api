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
 * Hook for checking whether the current user can use group selection.
 *
 * PLG users have the group concept hidden everywhere in their UI; their API keys
 * are always forced to the `plg` group by the backend. Any non-plg user group keeps
 * the full group UI. The old is_enterprise flag is intentionally ignored.
 */
import { useAuthStore } from '@/stores/auth-store'

/**
 * Returns true when the current user can use group selection.
 */
export function useCanUseGroups(): boolean {
  return useAuthStore((state) => {
    const user = state.auth.user
    if (!user) return false
    const group = user.group
    if (group === undefined) return false
    return group !== '' && group !== 'plg'
  })
}

export const useIsEnterprise = useCanUseGroups
