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
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test, vi } from 'vitest'

import { routeTree } from '@/routeTree.gen'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

test('registers the authenticated app frame route', () => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory(),
    context: { queryClient: new QueryClient() },
  })

  expect(router.routesById['/_authenticated/apps/$appKey']).toBeDefined()
  expect(router.routesById['/_authenticated/apps/$appKey']?.fullPath).toBe(
    '/apps/$appKey'
  )
})
