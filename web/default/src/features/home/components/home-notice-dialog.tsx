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
import { useEffect, useState } from 'react'
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getNotice } from '@/lib/api'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useStatus } from '@/hooks/use-status'

interface AnnouncementItem {
  type?: string
  content?: string
  extra?: string
  publishDate?: string
}

export function HomeNoticeDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const { data: noticeResponse } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5,
  })

  const { status } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements: AnnouncementItem[] = announcementsEnabled
    ? ((status?.announcements || []) as AnnouncementItem[]).slice(0, 20)
    : []

  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  const hasNotice = !!noticeContent
  const hasAnnouncements = announcements.length > 0

  useEffect(() => {
    if (hasNotice || hasAnnouncements) {
      setOpen(true)
    }
  }, [hasNotice, hasAnnouncements])

  if (!hasNotice && !hasAnnouncements) return null

  const defaultTab = hasNotice ? 'notice' : 'announcements'

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent size='default' className='!max-w-(--container-xl) !grid-rows-[auto_1fr_auto] max-h-[85vh]'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('System Announcements')}</AlertDialogTitle>
          <AlertDialogDescription className='sr-only'>
            {t('Latest platform updates and notices')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Tabs defaultValue={defaultTab} className='flex min-h-0 flex-col overflow-hidden'>
          <TabsList className='grid w-full shrink-0 grid-cols-2'>
            <TabsTrigger value='notice' className='gap-1.5' disabled={!hasNotice}>
              <Bell className='size-3.5' />
              {t('Notice')}
            </TabsTrigger>
            <TabsTrigger value='announcements' className='gap-1.5' disabled={!hasAnnouncements}>
              <Megaphone className='size-3.5' />
              {t('Timeline')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='notice' className='mt-2 min-h-0 flex-1'>
            {hasNotice ? (
              <ScrollArea className='h-full pr-3'>
                <Markdown>{noticeContent}</Markdown>
              </ScrollArea>
            ) : (
              <Empty className='min-h-32 border-0 p-4'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Bell />
                  </EmptyMedia>
                  <EmptyTitle>{t('No announcements at this time')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>

          <TabsContent value='announcements' className='mt-2 min-h-0 flex-1'>
            {hasAnnouncements ? (
              <ScrollArea className='h-full pr-3'>
                <div className='flex flex-col'>
                  {announcements.map((item, idx) => {
                    const publishDate = item.publishDate
                      ? new Date(item.publishDate)
                      : null
                    const absoluteTime = publishDate
                      ? formatDateTimeObject(publishDate)
                      : ''

                    return (
                      <div key={idx}>
                        <div className='py-2.5'>
                          <div className='flex items-start gap-3'>
                            <span
                              className={cn(
                                'mt-1.5 inline-block size-2 shrink-0 rounded-full',
                                getAnnouncementColorClass(item.type)
                              )}
                            />
                            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                              <div className='text-sm'>
                                <Markdown>{item.content || ''}</Markdown>
                              </div>
                              {item.extra ? (
                                <div className='text-muted-foreground text-xs'>
                                  <Markdown>{item.extra}</Markdown>
                                </div>
                              ) : null}
                              {absoluteTime ? (
                                <div className='text-muted-foreground text-xs'>
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
            ) : (
              <Empty className='min-h-32 border-0 p-4'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Megaphone />
                  </EmptyMedia>
                  <EmptyTitle>{t('No system announcements')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('Close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
