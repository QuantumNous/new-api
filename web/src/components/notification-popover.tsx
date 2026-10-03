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
import type { TFunction } from 'i18next'
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatTimestampRelative } from '@/lib/format'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

interface AnnouncementItem {
  id?: number | string
  type?: string
  content?: string
  extra?: string
  publishDate?: string | Date
}

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unreadCount: number
  activeTab: 'notice' | 'announcements'
  onTabChange: (tab: 'notice' | 'announcements') => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
  className?: string
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(
  publishDate: string | Date,
  t: TFunction,
  locale: string | undefined
): string {
  if (!publishDate) return ''

  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (Number.isNaN(pubDate.getTime())) {
    return typeof publishDate === 'string' ? publishDate : ''
  }

  const diffMs = Date.now() - pubDate.getTime()

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  if (diffMs < 60 * 1000) return t('Just now')

  // Two years or more, show specific date
  if (diffMs >= 2 * 365 * 24 * 60 * 60 * 1000) {
    return formatDateTimeObject(pubDate)
  }

  return formatTimestampRelative(pubDate.getTime(), 'milliseconds', locale)
}

/**
 * Announcement status dot indicator
 */
function AnnouncementDot({ type }: { type?: string }) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-block size-2 shrink-0 rounded-full',
        getAnnouncementColorClass(type)
      )}
    />
  )
}

function getAnnouncementRenderKey(announcement: AnnouncementItem): string {
  if (announcement.id !== undefined && announcement.id !== null) {
    return `id:${announcement.id}`
  }

  return JSON.stringify({
    content: announcement.content ?? '',
    extra: announcement.extra ?? '',
    publishDate: announcement.publishDate ?? '',
    type: announcement.type ?? '',
  })
}

/**
 * Empty state component
 */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <Empty className='min-h-48 border-0 p-4'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}

/**
 * Notice tab content
 */
function NoticeContent({
  notice,
  loading,
  t,
}: {
  notice: string
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (!notice) {
    return (
      <EmptyState icon={<Bell />} title={t('No announcements at this time')} />
    )
  }

  return (
    <ScrollArea className='h-[min(52vh,28rem)] pr-3'>
      <RichContent breaks content={notice} />
    </ScrollArea>
  )
}

/**
 * Announcements tab content
 */
function AnnouncementsContent({
  announcements,
  loading,
  t,
}: {
  announcements: AnnouncementItem[]
  loading: boolean
  t: TFunction
}) {
  const { i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (loading) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (announcements.length === 0) {
    return (
      <EmptyState icon={<Megaphone />} title={t('No system announcements')} />
    )
  }

  return (
    <ScrollArea className='h-[min(52vh,28rem)] pr-3'>
      <div className='flex flex-col'>
        {announcements.map((item, idx) => {
          const announcementKey = getAnnouncementRenderKey(item)
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, t, locale)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''

          return (
            <div key={announcementKey}>
              <div className='py-3'>
                <div className='flex items-start gap-3'>
                  <AnnouncementDot type={item.type} />
                  <div className='flex min-w-0 flex-1 flex-col gap-2'>
                    <div className='text-sm'>
                      <RichContent breaks content={item.content || ''} />
                    </div>

                    {item.extra ? (
                      <div className='text-muted-foreground text-xs'>
                        <RichContent breaks content={item.extra} />
                      </div>
                    ) : null}

                    {absoluteTime ? (
                      <div className='text-muted-foreground text-xs'>
                        {relativeTime ? `${relativeTime} • ` : null}
                        {absoluteTime}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {idx < announcements.length - 1 ? <Separator /> : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Notification popover with Notice and Announcements tabs
 */
export function NotificationPopover({
  open,
  onOpenChange,
  unreadCount,
  activeTab,
  onTabChange,
  notice,
  announcements,
  loading,
  className,
}: NotificationPopoverProps) {
  const { t } = useTranslation()
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className={cn('relative size-9', className)}
            aria-label={t('Notifications')}
          />
        }
      >
        <Bell className='size-[1.2rem]' />
        {unreadCount > 0 ? (
          <Badge
            variant='destructive'
            className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align='end'
        sideOffset={8}
        className='w-[min(26rem,calc(100vw-1rem))] gap-3 p-3'
      >
        <PopoverHeader className='gap-1 px-1'>
          <PopoverTitle>{t('System Announcements')}</PopoverTitle>
          <p className='text-muted-foreground text-xs'>
            {t('Latest platform updates and notices')}
          </p>
        </PopoverHeader>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange as (value: string) => void}
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='notice' className='gap-1.5'>
              <Bell className='size-3.5' />
              {t('Notice')}
            </TabsTrigger>
            <TabsTrigger value='announcements' className='gap-1.5'>
              <Megaphone className='size-3.5' />
              {t('Timeline')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='notice' className='mt-2'>
            <NoticeContent notice={notice} loading={loading} t={t} />
          </TabsContent>

          <TabsContent value='announcements' className='mt-2'>
            <AnnouncementsContent
              announcements={announcements}
              loading={loading}
              t={t}
            />
          </TabsContent>
        </Tabs>

        <div className='flex justify-end'>
          <Button size='sm' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
