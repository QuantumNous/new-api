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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NavGroup } from '@/components/layout/types'

import { useSidebarConfig } from '../use-sidebar-config'

const navGroups: NavGroup[] = [
  {
    id: 'analytics',
    title: 'Analytics',
    items: [
      { title: 'Usage & costs', url: '/dashboard/models' },
      { title: 'Flow', url: '/dashboard/flow' },
      { title: 'Overview', url: '/dashboard/overview' },
    ],
  },
]

function renderSidebarConfig(dataExportEnabled: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['status'], {
    enable_data_export: dataExportEnabled,
  })

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }

  return renderHook(() => useSidebarConfig(navGroups), { wrapper: Wrapper })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('data dashboard sidebar visibility', () => {
  it('hides data dashboard destinations when data export is disabled', () => {
    const { result } = renderSidebarConfig(false)

    expect(result.current[0]?.items.map((item) => item.title)).toEqual([
      'Overview',
    ])
  })

  it('shows data dashboard destinations when data export is enabled', () => {
    const { result } = renderSidebarConfig(true)

    expect(result.current[0]?.items.map((item) => item.title)).toEqual([
      'Usage & costs',
      'Flow',
      'Overview',
    ])
  })
})
