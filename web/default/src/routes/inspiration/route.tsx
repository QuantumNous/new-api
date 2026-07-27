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
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { PublicLayout } from '@/components/layout'
import { getFreshModuleAccess } from '@/lib/nav-modules'

/**
 * Inspiration runs on the marketing-site shell, not the console shell: it is a
 * public-facing product surface, and the canvas needs the whole viewport.
 */
export const Route = createFileRoute('/inspiration')({
  beforeLoad: async () => {
    const access = await getFreshModuleAccess('inspiration')
    if (!access.enabled) throw redirect({ to: '/' })
  },
  component: InspirationLayout,
})

function InspirationLayout() {
  return (
    <PublicLayout showMainContainer={false}>
      {/* pt-16 matches the unscrolled PublicHeader, which floats over content. */}
      <div className='flex h-dvh max-h-dvh flex-col overflow-hidden pt-16'>
        <Outlet />
      </div>
    </PublicLayout>
  )
}
