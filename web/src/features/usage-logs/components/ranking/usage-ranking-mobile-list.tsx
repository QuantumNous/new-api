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
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCompactNumber,
  formatQuota,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import type { UsageRankingItem } from '../../types'
import {
  formatUsageRankingRatio,
  getUsageRankingRowKey,
  renderUsageRankingRank,
} from './usage-ranking-columns'
import { UsageRankingGroupDetails } from './usage-ranking-table'

interface UsageRankingMobileListProps {
  items: UsageRankingItem[]
  loading: boolean
  expandedRows: Set<string>
  onToggleRow: (rowKey: string) => void
}

function RankingMetric(props: { label: string; value: string }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='truncate text-sm font-medium tabular-nums'>
        {props.value}
      </span>
    </div>
  )
}

export function UsageRankingMobileList(props: UsageRankingMobileListProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='flex flex-col gap-2'>
        {[0, 1, 2].map((index) => (
          <Card key={index} size='sm'>
            <CardHeader>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-20' />
            </CardHeader>
            <CardContent className='grid grid-cols-2 gap-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (props.items.length === 0) {
    return (
      <Empty className='min-h-56 border'>
        <EmptyHeader>
          <EmptyTitle>{t('No Ranking Data')}</EmptyTitle>
          <EmptyDescription>
            {t('No usage was found for the selected ranking filters.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-2 pb-2'>
      {props.items.map((item) => {
        const rowKey = getUsageRankingRowKey(item)
        const expanded = props.expandedRows.has(rowKey)
        return (
          <Collapsible
            key={rowKey}
            open={expanded}
            onOpenChange={(nextOpen) => {
              if (nextOpen !== expanded) props.onToggleRow(rowKey)
            }}
          >
            <Card size='sm'>
              <CardHeader>
                <CardTitle className='truncate'>
                  {item.username || '-'}
                </CardTitle>
                <CardDescription>ID: {item.user_id}</CardDescription>
                <CardAction>{renderUsageRankingRank(item.rank)}</CardAction>
              </CardHeader>
              <CardContent className='grid grid-cols-2 gap-3'>
                <RankingMetric
                  label={t('Consumed Quota')}
                  value={formatQuota(item.quota)}
                />
                <RankingMetric
                  label={t('Request Count')}
                  value={formatCompactNumber(item.request_count)}
                />
                <RankingMetric
                  label={t('Total Tokens')}
                  value={formatCompactNumber(item.total_tokens)}
                />
                <RankingMetric
                  label={t('Error Rate')}
                  value={`${formatUsageRankingRatio(item.error_rate)} (${formatCompactNumber(item.error_count)})`}
                />
                <RankingMetric
                  label={t('Latest Request Time')}
                  value={formatTimestampToDate(item.last_used_at)}
                />
              </CardContent>
              <CardFooter className='flex-col items-stretch gap-2'>
                <CollapsibleTrigger
                  render={
                    <Button
                      type='button'
                      variant='ghost'
                      className='w-full'
                      aria-expanded={expanded}
                    />
                  }
                >
                  {expanded ? t('Collapse') : t('View Details')}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    data-icon='inline-end'
                    className={cn(
                      'transition-transform duration-200',
                      expanded && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className='flex flex-col gap-3 pt-1'>
                  <div className='grid grid-cols-2 gap-3'>
                    <RankingMetric
                      label={t('Input Tokens')}
                      value={formatCompactNumber(item.prompt_tokens)}
                    />
                    <RankingMetric
                      label={t('Output Tokens')}
                      value={formatCompactNumber(item.completion_tokens)}
                    />
                    <RankingMetric
                      label={t('Average Duration')}
                      value={formatUseTime(item.avg_use_time)}
                    />
                    <RankingMetric
                      label={t('Stream Ratio')}
                      value={formatUsageRankingRatio(item.stream_ratio)}
                    />
                    <RankingMetric
                      label={t('Models')}
                      value={formatCompactNumber(item.model_count)}
                    />
                    <RankingMetric
                      label={t('Tokens')}
                      value={formatCompactNumber(item.token_count)}
                    />
                    <RankingMetric
                      label={t('Groups')}
                      value={formatCompactNumber(item.group_count)}
                    />
                    <RankingMetric
                      label={t('Channels')}
                      value={formatCompactNumber(item.channel_count)}
                    />
                  </div>
                  {item.group_stats.length > 0 && (
                    <UsageRankingGroupDetails groups={item.group_stats} />
                  )}
                </CollapsibleContent>
              </CardFooter>
            </Card>
          </Collapsible>
        )
      })}
    </div>
  )
}
