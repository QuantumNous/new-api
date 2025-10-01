import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { getPreviewText } from '@/features/dashboard/utils'
import { PanelWrapper } from '../ui/panel-wrapper'
import { AnnouncementDetailModal } from './dialog/announcement-detail'

function AnnouncementStatusDot({ type }: { type?: string }) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full',
        getAnnouncementColorClass(type)
      )}
    />
  )
}

export function AnnouncementsPanel() {
  const { items: list, loading } = useAnnouncements()
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAnnouncementClick = (item: any) => {
    setSelectedAnnouncement(item)
    setIsDialogOpen(true)
  }

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Megaphone className='h-5 w-5' />
          Announcements
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage='No announcements at this time'
      height='h-64'
    >
      <ScrollArea className='h-64'>
        <div className='space-y-0 pe-4'>
          {list.map((item: any, idx: number) => (
            <div key={idx}>
              <button
                onClick={() => handleAnnouncementClick(item)}
                className='group hover:bg-accent/50 -mx-2 w-full rounded-lg px-2 py-3 text-left transition-colors'
              >
                <div className='flex items-start gap-2.5'>
                  <AnnouncementStatusDot type={item.type} />
                  <div className='min-w-0 flex-1 space-y-1.5'>
                    <p className='line-clamp-1 text-sm font-medium'>
                      {getPreviewText(item.content)}
                    </p>
                    <div className='flex items-center justify-between'>
                      {item.publishDate && (
                        <time className='text-muted-foreground text-xs'>
                          {formatDateTimeObject(new Date(item.publishDate))}
                        </time>
                      )}
                      <span className='text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100'>
                        Click for details
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              {idx < list.length - 1 && <Separator className='my-0' />}
            </div>
          ))}
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
