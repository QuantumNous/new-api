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
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [forceDialogOpen, setForceDialogOpen] = useState(false)
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

  const markAnnouncementsAsRead = () => {
    if (announcements.length > 0) {
      const allKeys = announcements.map((item: Record<string, unknown>) =>
        getAnnouncementKey(item)
      )
      markAnnouncementsRead(allKeys)
    }
  }

  // Handle popover open
  const handleOpenPopover = (tab?: NotificationTab) => {
    const nextTab = tab || activeTab

    // Mark currently visible content as read when opening the notification center
    if (noticeContent) {
      markNoticeRead(noticeContent)
    }
    if (nextTab === 'announcements') {
      markAnnouncementsAsRead()
    }

    setActiveTab(nextTab)
    setPopoverOpen(true)
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      handleOpenPopover(activeTab)
      return
    }

    setPopoverOpen(false)
  }

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = (tab: NotificationTab) => {
    setActiveTab(tab)

    if (tab === 'announcements') {
      markAnnouncementsAsRead()
    }
  }

  const handleOpenForcePopup = useCallback(() => {
    if (
      !pendingNoticeForcePopup &&
      pendingAnnouncementForcePopupKeys.length === 0
    ) {
      return false
    }

    const nextTab = pendingNoticeForcePopup ? 'notice' : 'announcements'
    setActiveTab(nextTab)
    if (nextTab === 'notice' && noticeContent) {
      markNoticeRead(noticeContent)
    }
    if (nextTab === 'announcements') {
      markAnnouncementsAsRead()
    }
    setForceDialogOpen(true)
    return true
  }, [
    markNoticeRead,
    noticeContent,
    pendingAnnouncementForcePopupKeys.length,
    pendingNoticeForcePopup,
    markAnnouncementsAsRead,
  ])

  // Handle "Close Today" action for forced popups.
  const handleCloseToday = () => {
    const today = new Date().toDateString()
    setClosedUntilDate(today)
    setPopoverOpen(false)
    setForceDialogOpen(false)
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

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,
    // Backward-compatible dialog aliases used by force-popup callers.
    dialogOpen: forceDialogOpen,
    setDialogOpen: setForceDialogOpen,
    forceDialogOpen,
    setForceDialogOpen,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openDialog: handleOpenPopover,
    openForcePopup: handleOpenForcePopup,
    closeDialog: () => setForceDialogOpen(false),
    closeToday: handleCloseToday,
    openPopover: handleOpenPopover,
    closePopover: () => setPopoverOpen(false),
    refetchNotice,

    // Status
    isNoticeClosed: isNoticeClosed(),
    hasPendingForcePopup:
      pendingNoticeForcePopup || pendingAnnouncementForcePopupKeys.length > 0,
    forcePopupKeySignature,
  }
}
