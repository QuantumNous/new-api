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
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotifications } from '@/hooks/use-notifications'
import { api } from '@/lib/api'
import { useNotificationStore } from '@/stores/notification-store'

import { useUpdateOption } from '../hooks/use-update-option'

describe('notice updates in the notification center', () => {
  let client: QueryClient

  beforeEach(() => {
    localStorage.clear()
    useNotificationStore.setState({
      lastReadNotice: 'Previous notice',
      readAnnouncementKeys: [],
      closedUntilDate: null,
    })
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['notice'], {
      success: true,
      data: 'Previous notice',
    })
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data: url === '/api/notice' ? 'Published notice' : {},
      },
    }))
    vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  })

  afterEach(() => {
    cleanup()
    client.clear()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  function renderNoticeHooks() {
    return renderHook(
      () => ({ notices: useNotifications(), update: useUpdateOption() }),
      {
        wrapper: (props: { children: ReactNode }) => (
          <QueryClientProvider client={client}>
            {props.children}
          </QueryClientProvider>
        ),
      }
    )
  }

  it('refreshes fresh notice content from the server after saving', async () => {
    const { result } = renderNoticeHooks()
    expect(result.current.notices.notice).toBe('Previous notice')
    expect(result.current.notices.unreadNoticeCount).toBe(0)

    await act(() =>
      result.current.update.mutateAsync({
        key: 'Notice',
        value: 'Draft notice',
      })
    )

    await waitFor(() =>
      expect(result.current.notices.notice).toBe('Published notice')
    )
    expect(result.current.notices.unreadNoticeCount).toBe(1)
  })

  it('removes a cleared notice without requiring a page refresh', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: '' },
    })
    const { result } = renderNoticeHooks()

    await act(() =>
      result.current.update.mutateAsync({ key: 'Notice', value: '' })
    )

    await waitFor(() => expect(result.current.notices.notice).toBe(''))
    expect(result.current.notices.unreadNoticeCount).toBe(0)
  })

  it('keeps the previous notice when saving is rejected', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { success: false, message: 'Save rejected' },
    })
    const { result } = renderNoticeHooks()

    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          key: 'Notice',
          value: 'Draft notice',
        })
      ).rejects.toThrow('Save rejected')
    })

    expect(result.current.notices.notice).toBe('Previous notice')
    expect(
      vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/notice')
    ).toHaveLength(0)
  })

  it('does not refetch the notice when an unrelated setting changes', async () => {
    const { result } = renderNoticeHooks()

    await act(() =>
      result.current.update.mutateAsync({ key: 'SystemName', value: 'Example' })
    )

    expect(result.current.notices.notice).toBe('Previous notice')
    expect(
      vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/notice')
    ).toHaveLength(0)
  })
})
