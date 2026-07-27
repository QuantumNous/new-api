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

import { InspirationHeader } from '@/features/inspiration/components/inspiration-header'
import { getFreshModuleAccess } from '@/lib/nav-modules'

/**
 * Standalone shell for the Inspiration product. It deliberately avoids the
 * console layout (sidebar + console header) so the canvas owns the viewport.
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
    <div className='bg-background text-foreground flex h-dvh flex-col overflow-hidden'>
      <InspirationHeader />
      <main className='min-h-0 flex-1 overflow-hidden'>
        <Outlet />
      </main>
    </div>
  )
}
