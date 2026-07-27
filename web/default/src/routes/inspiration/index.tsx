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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { InspirationHome } from '@/features/inspiration/components/inspiration-home'

export const Route = createFileRoute('/inspiration/')({
  validateSearch: z.object({
    view: z.enum(['templates', 'projects']).optional(),
  }),
  component: InspirationIndexPage,
})

function InspirationIndexPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <InspirationHome
        view={search.view ?? 'templates'}
        onViewChange={(view) =>
          void navigate({ to: '/inspiration', search: { view } })
        }
      />
    </div>
  )
}
