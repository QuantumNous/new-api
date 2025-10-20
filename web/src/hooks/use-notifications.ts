import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNotificationStore } from '@/stores/notification-store'
import { getNotice } from '@/lib/api'
import { useStatus } from '@/hooks/use-status'

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
function getAnnouncementKey(item: any): string {
  if (!item) return ''

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  const fingerprint = JSON.stringify({
    publishDate: item?.publishDate || '',
    content: (item?.content || '').trim(),
    extra: (item?.extra || '').trim(),
    type: item?.type || '',
    title: (item?.title || '').trim(),
    link: (item?.link || '').trim(),
  })
  return `hash:${hashString(fingerprint)}`
}

/**
 * Hook to manage notifications (Notice + Announcements)
 * Provides unread counts and read status management
 */
export function useNotifications() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notice' | 'announcements'>(
    'notice'
  )

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
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements = announcementsEnabled
    ? (status?.announcements || []).slice(0, 20)
    : []

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
    let noticeUnread = 0
    let announcementsUnread = 0

    // Check if Notice is unread (content changed or never read)
    if (noticeContent) {
      if (noticeContent !== lastReadNotice) {
        noticeUnread = 1
      }
    }

    // Check unread announcements
    announcementsUnread = announcements.filter((item: any) => {
      const key = getAnnouncementKey(item)
      return !isAnnouncementRead(key)
    }).length

    return {
      notice: noticeUnread,
      announcements: announcementsUnread,
      total: noticeUnread + announcementsUnread,
    }
  }, [noticeContent, lastReadNotice, announcements, isAnnouncementRead])

  // Handle dialog open
  const handleOpenDialog = (tab?: 'notice' | 'announcements') => {
    // Mark Notice as read when opening dialog
    if (noticeContent) {
      markNoticeRead(noticeContent)
    }

    setActiveTab(tab || 'notice')
    setDialogOpen(true)
  }

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = (tab: 'notice' | 'announcements') => {
    setActiveTab(tab)

    if (tab === 'announcements' && announcements.length > 0) {
      const allKeys = announcements.map((item: any) => getAnnouncementKey(item))
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
    loading: noticeLoading || statusLoading,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadNoticeCount: unreadCounts.notice,
    unreadAnnouncementsCount: unreadCounts.announcements,

    // Dialog state
    dialogOpen,
    setDialogOpen,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openDialog: handleOpenDialog,
    closeDialog: () => setDialogOpen(false),
    closeToday: handleCloseToday,
    refetchNotice,

    // Status
    isNoticeClosed: isNoticeClosed(),
  }
}
