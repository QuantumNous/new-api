import { Megaphone } from 'lucide-react'
import { formatDateTimeObject } from '@/lib/time'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { InfoPanel } from '../ui/info-panel'

export function AnnouncementsPanel() {
  const { items: list } = useAnnouncements()

  return (
    <InfoPanel
      title={
        <span className='flex items-center gap-2'>
          <Megaphone className='h-5 w-5' />
          Announcements
        </span>
      }
      items={list}
      emptyMessage='No announcements.'
      renderItem={(it: any, idx: number) => (
        <div key={idx} className='space-y-0.5'>
          <div className='text-sm font-medium'>{it.content}</div>
          <div className='text-muted-foreground text-xs'>
            {it.publishDate
              ? formatDateTimeObject(new Date(it.publishDate))
              : ''}
          </div>
          {!!it.extra && (
            <div className='text-muted-foreground text-xs'>{it.extra}</div>
          )}
        </div>
      )}
    />
  )
}
