import { Zap, ExternalLink, Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getBgColorClass } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import {
  getLatencyColorClass,
  openExternalSpeedTest,
} from '@/features/dashboard/lib/api-info'
import type { ApiInfoItem, PingStatus } from '@/features/dashboard/types'

interface ApiInfoItemProps {
  item: ApiInfoItem
  status: PingStatus
  onTest: (url: string) => void
}

export function ApiInfoItemComponent({
  item,
  status,
  onTest,
}: ApiInfoItemProps) {
  const { t } = useTranslation()
  return (
    <div className='group relative flex items-center justify-between gap-3 py-2.5 text-sm'>
      {/* Left: status dot + content */}
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        {/* Colored status dot */}
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            getBgColorClass(item.color)
          )}
        />

        {/* Name and URL */}
        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <div className='flex items-baseline gap-2'>
            <span className='shrink-0 font-medium'>{item.route}</span>
            <span className='text-muted-foreground hidden truncate text-xs md:inline'>
              {item.description}
            </span>
          </div>
          <span className='text-muted-foreground truncate text-xs opacity-70'>
            {item.url}
          </span>
        </div>
      </div>

      {/* Right: status + action buttons */}
      <div className='flex shrink-0 items-center gap-2'>
        {/* Latency status badge */}
        <div className='flex items-center'>
          {status.testing && (
            <Badge
              variant='outline'
              className='text-muted-foreground h-5 animate-pulse px-2 text-xs'
            >
              {t('Testing...')}
            </Badge>
          )}
          {status.latency !== null && !status.testing && (
            <Badge
              variant='outline'
              className={cn(
                'h-5 border-current px-2 text-xs font-medium',
                getLatencyColorClass(status.latency)
              )}
            >
              {status.latency}
              {t('ms')}
            </Badge>
          )}
          {status.error && (
            <Badge
              variant='outline'
              className='text-muted-foreground h-5 px-2 text-xs'
            >
              {t('N/A')}
            </Badge>
          )}
        </div>

        {/* Action buttons - always visible */}
        <div className='flex items-center gap-0.5'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onTest(item.url)}
            disabled={status.testing}
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title={t('Test Latency')}
          >
            <Zap
              className={cn('h-3.5 w-3.5', status.testing && 'animate-pulse')}
            />
          </Button>

          <Button
            variant='ghost'
            size='sm'
            onClick={() => openExternalSpeedTest(item.url)}
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title={t('External Speed Test')}
          >
            <Gauge className='h-3.5 w-3.5' />
          </Button>

          <CopyButton
            value={item.url}
            variant='ghost'
            size='sm'
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            iconClassName='h-3.5 w-3.5'
            tooltip={t('Copy URL')}
            aria-label={t('Copy URL')}
          />

          <Button
            variant='ghost'
            size='sm'
            asChild
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title={t('Open in New Tab')}
          >
            <a href={item.url} target='_blank' rel='noreferrer'>
              <ExternalLink className='h-3.5 w-3.5' />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
