import { Route } from 'lucide-react'
import { getColorClass } from '@/lib/colors'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import { InfoPanel } from './ui/info-panel'

export function ApiInfoPanel() {
  const { items: list } = useApiInfo()

  return (
    <InfoPanel
      title={
        <span className='flex items-center gap-2'>
          <Route className='h-5 w-5' />
          API Info
        </span>
      }
      items={list}
      emptyMessage='No API routes configured.'
      renderItem={(it: any, idx: number) => (
        <div
          key={idx}
          className='flex items-center justify-between gap-4 text-sm'
        >
          <div className='min-w-0 flex-1 truncate'>
            <div className='flex items-center gap-2 truncate'>
              <span className={getColorClass(it.color)}>●</span>
              <span className='truncate'>{it.route}</span>
            </div>
            <div className='text-muted-foreground truncate'>
              {it.description}
            </div>
          </div>
          <a
            href={it.url}
            target='_blank'
            rel='noreferrer'
            className='text-primary underline-offset-4 hover:underline'
          >
            Visit
          </a>
        </div>
      )}
    />
  )
}
