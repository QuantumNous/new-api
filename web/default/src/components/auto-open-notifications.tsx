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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useNotificationStore } from '@/stores/notification-store'
import { getNotice, getStatus } from '@/lib/api'
import {
  AUTO_OPEN_NOTIFICATIONS_EVENT,
  AUTO_OPEN_NOTIFICATIONS_STORAGE_KEY,
} from '@/lib/notification-auto-open'
import { getAnnouncementKey } from '@/lib/notification-key'
import { NotificationDialog } from '@/components/notification-dialog'

type NotificationTab = 'notice' | 'announcements'

type NotificationSnapshot = {
  notice: string
  announcements: Record<string, unknown>[]
}

function getAnnouncementsFromStatus(
  status: Record<string, unknown> | null
): Record<string, unknown>[] {
  if (!status?.announcements_enabled) return []

  return ((status.announcements || []) as Record<string, unknown>[]).slice(
    0,
    20
  )
}

export function AutoOpenNotifications() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>('notice')
  const [snapshot, setSnapshot] = useState<NotificationSnapshot>({
    notice: '',
    announcements: [],
  })
  const [loading, setLoading] = useState(false)
  const checkingRef = useRef(false)

  const {
    markNoticeRead,
    markAnnouncementsRead,
    setClosedUntilDate,
  } = useNotificationStore()

  const openSnapshot = useCallback(
    (nextSnapshot: NotificationSnapshot, tab: NotificationTab) => {
      if (nextSnapshot.notice) {
        markNoticeRead(nextSnapshot.notice)
      }

      if (tab === 'announcements' && nextSnapshot.announcements.length > 0) {
        markAnnouncementsRead(
          nextSnapshot.announcements.map((item) => getAnnouncementKey(item))
        )
      }

      setSnapshot(nextSnapshot)
      setActiveTab(tab)
      setDialogOpen(true)
    },
    [markAnnouncementsRead, markNoticeRead]
  )

  const checkAndOpenUnread = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    window.sessionStorage.removeItem(AUTO_OPEN_NOTIFICATIONS_STORAGE_KEY)
    setLoading(true)

    try {
      const [status, noticeResponse] = await Promise.all([
        getStatus().catch(() => null),
        getNotice().catch(() => null),
      ])

      const notice = noticeResponse?.success
        ? (noticeResponse.data || '').trim()
        : ''
      const announcements = getAnnouncementsFromStatus(status)
      const store = useNotificationStore.getState()

      const hasUnreadNotice = Boolean(
        notice && notice !== store.lastReadNotice
      )
      const hasUnreadAnnouncement = announcements.some((item) => {
        const key = getAnnouncementKey(item)
        return key && !store.isAnnouncementRead(key)
      })

      if (!hasUnreadNotice && !hasUnreadAnnouncement) return

      openSnapshot(
        { notice, announcements },
        hasUnreadNotice ? 'notice' : 'announcements'
      )
    } finally {
      checkingRef.current = false
      setLoading(false)
    }
  }, [openSnapshot])

  useEffect(() => {
    const onAutoOpen = () => {
      void checkAndOpenUnread()
    }

    window.addEventListener(AUTO_OPEN_NOTIFICATIONS_EVENT, onAutoOpen)

    if (
      window.sessionStorage.getItem(AUTO_OPEN_NOTIFICATIONS_STORAGE_KEY) ===
      '1'
    ) {
      void checkAndOpenUnread()
    }

    return () => {
      window.removeEventListener(AUTO_OPEN_NOTIFICATIONS_EVENT, onAutoOpen)
    }
  }, [checkAndOpenUnread])

  useEffect(() => {
    if (
      window.sessionStorage.getItem(AUTO_OPEN_NOTIFICATIONS_STORAGE_KEY) !==
      '1'
    ) {
      return
    }

    void checkAndOpenUnread()
  }, [checkAndOpenUnread, pathname])

  const handleTabChange = (tab: NotificationTab) => {
    setActiveTab(tab)

    if (tab === 'announcements' && snapshot.announcements.length > 0) {
      markAnnouncementsRead(
        snapshot.announcements.map((item) => getAnnouncementKey(item))
      )
    }
  }

  const handleCloseToday = () => {
    setClosedUntilDate(new Date().toDateString())
    setDialogOpen(false)
  }

  return (
    <NotificationDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      notice={snapshot.notice}
      announcements={snapshot.announcements}
      loading={loading}
      onCloseToday={handleCloseToday}
    />
  )
}
