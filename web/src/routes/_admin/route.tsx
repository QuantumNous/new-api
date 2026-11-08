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
import { createFileRoute } from '@tanstack/react-router'

import { AdminLayout } from '@/apps/admin/layout/admin-layout'
import { requireAdminAccess } from '@/apps/admin/routes/guards'

/**
 * Admin portal branch.
 *
 * `_admin` is pathless so that `/admin/login` can live outside this guard while
 * every other `/admin/*` route inherits the Admin/Root RBAC check and the admin
 * layout.
 */
export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ location }) => requireAdminAccess(location.href),
  component: AdminLayout,
})
