import { memo, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { getPreviewText } from '@/features/dashboard/lib'
import type { AnnouncementItem } from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'
import { AnnouncementDetailModal } from './announcement-detail-dialog'

const AnnouncementStatusDot = memo(function AnnouncementStatusDot(props: {
  type?: string
}) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-block size-2 shrink-0 rounded-full',
        getAnnouncementColorClass(props.type)
      )}
    />
  )
})

export function AnnouncementsPanel() {
  const { t } = useTranslation()
  const { items: list, loading } = useAnnouncements()
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAnnouncementClick = (item: AnnouncementItem) => {
    setSelectedAnnouncement(item)
    setIsDialogOpen(true)
  }

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Megaphone className='text-muted-foreground/60 size-4' />
          {t('Announcements')}
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage={t('No announcements at this time')}
      height='h-56 sm:h-64'
    >
      <ScrollArea className='h-56 sm:h-64'>
        <div className='-mx-3 sm:-mx-5'>
          {list.map((item: AnnouncementItem, idx: number) => {
            const key = item.id ?? `announcement-${idx}`
            return (
              <button
                key={key}
                type='button'
                onClick={() => handleAnnouncementClick(item)}
                className={cn(
                  'group hover:bg-muted/40 w-full px-3 py-3 text-left transition-colors sm:px-5 sm:py-3.5',
                  idx < list.length - 1 && 'border-border/60 border-b'
                )}
              >
                <div className='flex items-start gap-2.5'>
                  <AnnouncementStatusDot type={item.type} />
                  <div className='min-w-0 flex-1 space-y-1'>
                    <p className='line-clamp-1 text-sm font-medium'>
                      {getPreviewText(item.content)}
                    </p>
                    <div className='flex items-center justify-between'>
                      {item.publishDate && (
                        <time className='text-muted-foreground/60 text-xs'>
                          {formatDateTimeObject(new Date(item.publishDate))}
                        </time>
                      )}
                      <span className='text-muted-foreground/40 text-xs opacity-0 transition-opacity group-hover:opacity-100'>
                        {t('Click for details')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <AnnouncementDetailModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        announcement={selectedAnnouncement}
      />
    </PanelWrapper>
  )
}
