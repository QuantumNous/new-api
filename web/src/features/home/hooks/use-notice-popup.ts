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
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getNotice } from '@/lib/api'
import { useNotificationStore } from '@/stores/notification-store'

/**
 * Drives the homepage notice dialog.
 *
 * Auto-opens the dialog once per mount when /api/notice returns non-empty
 * content and the user has not clicked "Close Today" for the current day.
 * Shares the ['notice'] React Query cache with the header bell, so it does not
 * issue an extra request. "Close Today" persists a per-day dismissal through
 * the notification store, which suppresses the dialog until the next day.
 */
export function useNoticePopup() {
  const { data: noticeResponse } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5, // 5 minutes, matches the header bell query
  })

  const { isNoticeClosed, setClosedUntilDate } = useNotificationStore()

  const [open, setOpen] = useState(false)
  const hasAutoOpened = useRef(false)

  const notice = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  useEffect(() => {
    if (hasAutoOpened.current) return
    if (!notice) return
    if (isNoticeClosed()) return

    hasAutoOpened.current = true
    setOpen(true)
  }, [notice, isNoticeClosed])

  const closeForToday = useCallback(() => {
    setClosedUntilDate(new Date().toDateString())
    setOpen(false)
  }, [setClosedUntilDate])

  return {
    notice,
    open,
    onOpenChange: setOpen,
    closeForToday,
  }
}
