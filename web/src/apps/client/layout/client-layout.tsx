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
import { AuthenticatedLayout } from '@/shared/components/layout/components/authenticated-layout'

import { useClientSidebarView } from './client-sidebar-view'

/**
 * Client portal shell.
 *
 * Composes the shared authenticated shell with the client navigation only, so
 * no admin component can leak into this layout.
 */
export function ClientLayout() {
  const { navGroups } = useClientSidebarView()
  return <AuthenticatedLayout navGroups={navGroups} />
}
