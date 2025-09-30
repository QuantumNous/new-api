import { formatDateTimeObject } from '@/lib/time'
import { useStatus } from '@/hooks/use-status'
import { InfoPanel } from './ui/info-panel'

export function AnnouncementsPanel() {
  const { status } = useStatus()
  const enabled = status?.announcements_enabled
  const list = enabled ? status?.announcements || [] : []

  return (
    <InfoPanel
      title='Announcements'
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
