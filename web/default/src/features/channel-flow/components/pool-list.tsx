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

import { useTranslation } from 'react-i18next'
import { Edit, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ChannelFlowPool, ChannelFlowPoolStatus } from '../types'

type PoolListProps = {
  pools: ChannelFlowPool[]
  selectedPoolId?: number
  status?: ChannelFlowPoolStatus | null
  loading: boolean
  onSelect: (pool: ChannelFlowPool) => void
  onEdit: (pool: ChannelFlowPool) => void
  onDelete: (pool: ChannelFlowPool) => void
}

export function PoolList(props: PoolListProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='space-y-2'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-24 rounded-lg' />
        ))}
      </div>
    )
  }

  if (props.pools.length === 0) {
    return (
      <div className='border-border/80 flex min-h-32 items-center justify-center rounded-lg border border-dashed px-4 text-center'>
        <span className='text-muted-foreground text-sm'>
          {t('No Flow Pools configured')}
        </span>
      </div>
    )
  }

  return (
    <div className='space-y-2 overflow-x-hidden'>
      {props.pools.map((pool) => {
        const isSelected = pool.id === props.selectedPoolId
        const liveStatus =
          isSelected && props.status?.pool_key === pool.pool_key
            ? props.status
            : null
        const inflightValue = liveStatus
          ? `${liveStatus.running}/${liveStatus.max_inflight}`
          : String(pool.max_inflight)
        const queuedValue = liveStatus
          ? `${liveStatus.queued}/${liveStatus.max_queue_size}`
          : String(pool.max_queue_size)
        const backendLabel =
          pool.backend === 'redis' && liveStatus?.backend === 'memory'
            ? t('Local memory fallback')
            : pool.backend === 'redis'
              ? t('Redis')
              : t('Memory')

        return (
          <div
            key={pool.id}
            role='button'
            tabIndex={0}
            className={cn(
              'group block w-full rounded-lg border bg-background p-3 text-left transition-colors',
              'hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              isSelected && 'border-primary/60 bg-primary/5 shadow-sm'
            )}
            onClick={() => props.onSelect(pool)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              props.onSelect(pool)
            }}
          >
            <div className='flex min-w-0 items-start gap-2'>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>{pool.name}</div>
                <div className='text-muted-foreground mt-1 truncate text-xs'>
                  {pool.pool_key || t('Generated after save')}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Edit Flow Pool')}
                  onClick={(event) => {
                    event.stopPropagation()
                    props.onEdit(pool)
                  }}
                >
                  <Edit className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Delete Flow Pool')}
                  onClick={(event) => {
                    event.stopPropagation()
                    props.onDelete(pool)
                  }}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            </div>

            <div className='mt-3 grid grid-cols-2 gap-2'>
              <PoolLimit
                label={liveStatus ? t('Inflight') : t('Max inflight')}
                value={inflightValue}
              />
              <PoolLimit
                label={liveStatus ? t('Queued') : t('Max queue size')}
                value={queuedValue}
              />
            </div>

            <div className='mt-3 flex flex-wrap gap-1.5'>
              <Badge variant={pool.enabled ? 'default' : 'secondary'}>
                {pool.enabled ? t('Enabled') : t('Disabled')}
              </Badge>
              <Badge variant={pool.backend === 'redis' ? 'outline' : 'secondary'}>
                {backendLabel}
              </Badge>
              <Badge variant='outline'>
                {pool.on_limit === 'queue'
                  ? t('Queue on limit')
                  : pool.on_limit === 'fallback'
                    ? t('Fallback on limit')
                    : t('Reject on limit')}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PoolLimit(props: { label: string; value: string }) {
  return (
    <div className='rounded-md bg-muted/35 px-2 py-1.5'>
      <div className='text-muted-foreground truncate text-xs'>{props.label}</div>
      <div className='mt-0.5 text-sm font-semibold tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}
