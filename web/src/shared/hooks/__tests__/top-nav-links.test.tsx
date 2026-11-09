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
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/stores/auth-store'

import { useTopNavLinks } from '../use-top-nav-links'

const state = vi.hoisted(() => ({
  status: null as Record<string, unknown> | null,
}))

vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({ status: state.status, loading: false, error: null }),
}))

afterEach(() => {
  state.status = null
  useAuthStore.getState().auth.reset('idle')
})

describe('top navigation documentation link', () => {
  it('omits the Docs entry when no documentation destination is configured', () => {
    state.status = { HeaderNavModules: JSON.stringify({ docs: true }) }

    const { result } = renderHook(() => useTopNavLinks())

    expect(result.current.some((link) => link.title === 'Docs')).toBe(false)
    // A fallback /docs href has no route and would land on the 404 page.
    expect(result.current.some((link) => link.href === '/docs')).toBe(false)
  })

  it('renders the configured documentation destination without the fallback', () => {
    state.status = {
      HeaderNavModules: JSON.stringify({ docs: true }),
      docs_link: '  https://docs.example.com  ',
    }

    const { result } = renderHook(() => useTopNavLinks())

    expect(result.current).toContainEqual(
      expect.objectContaining({
        title: 'Docs',
        href: 'https://docs.example.com',
      })
    )
  })
})
