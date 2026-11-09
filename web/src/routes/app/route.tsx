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

import { ClientLayout } from '@/apps/client/layout/client-layout'
import {
  requireClientAccess,
  requireVisibleClientSection,
} from '@/apps/client/routes/guards'
import { GeneralError } from '@/shared/features/errors/general-error'

/**
 * Client portal branch. Every `/app/*` route is guarded here, before any page
 * module is imported.
 */
export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => {
    await requireClientAccess(location.href)
    // Enforce the section allow-list before the page component renders.
    requireVisibleClientSection(location.href)
  },
  component: ClientLayout,
  // Route-resolution failures inside the portal use the router boundary
  // instead of a separate error page nested under the guarded layout.
  errorComponent: GeneralError,
})
