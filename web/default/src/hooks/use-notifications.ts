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
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNotificationStore } from '@/stores/notification-store'
import { getNotice } from '@/lib/api'
import { useStatus } from '@/hooks/use-status'

type NotificationTab = 'notice' | 'announcements'
type AnnouncementRecord = Record<string, unknown>

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return hash.toString(36)
}

/**
 * Generate a unique key for an announcement
 * Prefer backend id, fall back to a content hash so edits register
 */
function getAnnouncementKey(item: Record<string, unknown>): string {
  if (!item) return ''

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  const fingerprint = JSON.stringify({
    publishDate: (item?.publishDate as string) || '',
    content: ((item?.content as string) || '').trim(),
    extra: ((item?.extra as string) || '').trim(),
    type: (item?.type as string) || '',
    title: ((item?.title as string) || '').trim(),
    link: ((item?.link as string) || '').trim(),
  })
  return `hash:${hashString(fingerprint)}`
}

function getAnnouncementTime(item: AnnouncementRecord): number {
  const publishDate = item?.publishDate
  if (!publishDate) return 0

  const time = new Date(publishDate as string).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isPublishedAnnouncement(item: AnnouncementRecord): boolean {
  const publishTime = getAnnouncementTime(item)
  return publishTime > 0 && publishTime <= Date.now()
}

function isForcePopupCandidate(item: AnnouncementRecord): boolean {
  return (
    item?.forcePopup === true &&
    ((item?.content as string) || '').trim() !== '' &&
    isPublishedAnnouncement(item)
  )
}

function mergeVisibleAnnouncements(
  allAnnouncements: AnnouncementRecord[]
): AnnouncementRecord[] {
  const byKey = new Map<string, AnnouncementRecord>()

  for (const item of allAnnouncements.slice(0, 20)) {
    byKey.set(getAnnouncementKey(item), item)
  }
  for (const item of allAnnouncements.filter(isForcePopupCandidate)) {
    byKey.set(getAnnouncementKey(item), item)
  }

  return [...byKey.values()].sort(
    (a, b) => getAnnouncementTime(b) - getAnnouncementTime(a)
  )
}

/**
 * Hook to manage notifications (Notice + Announcements)
 * Provides unread counts and read status management
 */
export function useNotifications() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>('notice')

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const {
    status,
    loading: statusLoading,
    fetching: statusFetching,
  } = useStatus()
  const noticeForcePopupEnabled = status?.notice_force_popup === true
  const announcementsEnabled = status?.announcements_enabled ?? false
  const allAnnouncements: AnnouncementRecord[] = useMemo(
    () =>
      announcementsEnabled
        ? ((status?.announcements || []) as AnnouncementRecord[])
        : [],
    [announcementsEnabled, status?.announcements]
  )
  const announcements = useMemo(
    () => mergeVisibleAnnouncements(allAnnouncements),
    [allAnnouncements]
  )
  const forcePopupAnnouncements = useMemo(
    () => allAnnouncements.filter(isForcePopupCandidate),
    [allAnnouncements]
  )

  // Notification store
  const {
    lastReadNotice,
    markNoticeRead,
    markAnnouncementsRead,
    isAnnouncementRead,
    isNoticeClosed,
    setClosedUntilDate,
  } = useNotificationStore()

  // Extract notice content
  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const noticeUnread =
      noticeContent && noticeContent !== lastReadNotice ? 1 : 0

    const announcementsUnread = announcements.filter(
      (item: Record<string, unknown>) => {
        const key = getAnnouncementKey(item)
        return !isAnnouncementRead(key)
      }
    ).length

    return {
      notice: noticeUnread,
      announcements: announcementsUnread,
      total: noticeUnread + announcementsUnread,
    }
  }, [noticeContent, lastReadNotice, announcements, isAnnouncementRead])

  const pendingNoticeForcePopup =
    noticeForcePopupEnabled && noticeContent.trim() !== ''

  const pendingAnnouncementForcePopupKeys = useMemo(
    () => forcePopupAnnouncements.map((item) => getAnnouncementKey(item)),
    [forcePopupAnnouncements]
  )

  const forcePopupKeySignature = [
    ...(pendingNoticeForcePopup
      ? [`notice:${hashString(noticeContent.trim())}`]
      : []),
    ...pendingAnnouncementForcePopupKeys,
  ].join('|')

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open)
    },
    []
  )

  // Handle dialog open
  const handleOpenDialog = (tab?: NotificationTab) => {
    const nextTab = tab || 'notice'

    // Mark Notice as read when opening dialog
    if (nextTab === 'notice' && noticeContent) {
      markNoticeRead(noticeContent)
    }

    setActiveTab(nextTab)
    setDialogOpen(true)
  }

  const handleOpenForcePopup = useCallback(() => {
    if (
      !pendingNoticeForcePopup &&
      pendingAnnouncementForcePopupKeys.length === 0
    ) {
      return false
    }

    setActiveTab(pendingNoticeForcePopup ? 'notice' : 'announcements')
    setDialogOpen(true)
    return true
  }, [pendingAnnouncementForcePopupKeys.length, pendingNoticeForcePopup])

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = (tab: NotificationTab) => {
    setActiveTab(tab)

    if (tab === 'announcements' && announcements.length > 0) {
      const allKeys = announcements.map((item: Record<string, unknown>) =>
        getAnnouncementKey(item)
      )
      markAnnouncementsRead(allKeys)
    }
  }

  // Handle "Close Today" action
  const handleCloseToday = () => {
    const today = new Date().toDateString()
    setClosedUntilDate(today)
    setDialogOpen(false)
  }

  return {
    // Data
    notice: noticeContent,
    announcements,
    loading: noticeLoading || statusLoading || statusFetching,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadNoticeCount: unreadCounts.notice,
    unreadAnnouncementsCount: unreadCounts.announcements,

    // Dialog state
    dialogOpen,
    setDialogOpen: handleDialogOpenChange,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openDialog: handleOpenDialog,
    openForcePopup: handleOpenForcePopup,
    closeDialog: () => handleDialogOpenChange(false),
    closeToday: handleCloseToday,
    refetchNotice,

    // Status
    isNoticeClosed: isNoticeClosed(),
    hasPendingForcePopup:
      pendingNoticeForcePopup || pendingAnnouncementForcePopupKeys.length > 0,
    forcePopupKeySignature,
  }
}
