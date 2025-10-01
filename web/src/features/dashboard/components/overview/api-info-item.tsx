import { Zap, ExternalLink, Copy, Check, Gauge } from 'lucide-react'
import { getBgColorClass } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ApiInfoItem, PingStatus } from '@/features/dashboard/types'
import {
  getLatencyColorClass,
  openExternalSpeedTest,
} from '@/features/dashboard/utils/api-info'

interface ApiInfoItemProps {
  item: ApiInfoItem
  status: PingStatus
  isCopied: boolean
  onTest: (url: string) => void
  onCopy: (url: string) => void
}

export function ApiInfoItemComponent({
  item,
  status,
  isCopied,
  onTest,
  onCopy,
}: ApiInfoItemProps) {
  return (
    <div className='group relative flex items-center justify-between gap-3 py-2.5 text-sm'>
      {/* 左侧：状态点 + 内容区 */}
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        {/* 彩色状态点 */}
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            getBgColorClass(item.color)
          )}
        />

        {/* 名称和 URL */}
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

      {/* 右侧：状态 + 操作按钮 */}
      <div className='flex shrink-0 items-center gap-2'>
        {/* 延迟状态徽章 */}
        <div className='flex items-center'>
          {status.testing && (
            <Badge
              variant='outline'
              className='text-muted-foreground h-5 animate-pulse px-2 text-xs'
            >
              Testing...
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
              {status.latency}ms
            </Badge>
          )}
          {status.error && (
            <Badge
              variant='outline'
              className='text-muted-foreground h-5 px-2 text-xs'
            >
              N/A
            </Badge>
          )}
        </div>

        {/* 操作按钮组 - 始终显示 */}
        <div className='flex items-center gap-0.5'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onTest(item.url)}
            disabled={status.testing}
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title='Test Latency'
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
            title='External Speed Test'
          >
            <Gauge className='h-3.5 w-3.5' />
          </Button>

          <Button
            variant='ghost'
            size='sm'
            onClick={() => onCopy(item.url)}
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title='Copy URL'
          >
            {isCopied ? (
              <Check className='h-3.5 w-3.5 text-green-600' />
            ) : (
              <Copy className='h-3.5 w-3.5' />
            )}
          </Button>

          <Button
            variant='ghost'
            size='sm'
            asChild
            className='hover:bg-accent h-7 w-7 p-0 transition-all'
            title='Open in New Tab'
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
