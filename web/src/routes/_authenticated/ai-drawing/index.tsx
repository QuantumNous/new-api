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

import { Main } from '@/components/layout'
import { AiDrawing } from '@/features/ai-drawing'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/ai-drawing/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'ai_drawing')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AiDrawingPage,
})

function AiDrawingPage() {
  return (
    <Main className='overflow-y-auto p-4 md:p-6'>
      <AiDrawing />
    </Main>
  )
}
