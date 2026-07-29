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
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Eye,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'

import { getUserGroupStatus } from './api'
import { ModelStatusCard } from './components/model-status-card'
import { summarizeGroups } from './lib/status'

export function GroupStatusPage() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['user-group-status'],
    queryFn: getUserGroupStatus,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })

  const groups = query.data?.data ?? []
  const summary = summarizeGroups(groups)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Group status')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-1.5'
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch()
          }}
        >
          <RefreshCw
            className={query.isFetching ? 'size-3.5 animate-spin' : 'size-3.5'}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Check model availability by group, recent success rates, and performance over time.'
            )}
          </p>
          <section className='rounded-xl border'>
            <div className='border-b px-4 py-3 sm:px-5'>
              <h3 className='text-sm font-semibold'>
                {t('Group model status')}
              </h3>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t(
                  'Quickly see which models are stable, which have recent volatility, and roughly when issues appeared.'
                )}
              </p>
            </div>
            {query.isLoading ? (
              <SummarySkeleton />
            ) : (
              <div className='grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0'>
                <SummaryCell
                  label={t('Business groups')}
                  value={String(summary.groupCount)}
                  hint={t('Groups you can view')}
                  icon={Activity}
                  tone='info'
                />
                <SummaryCell
                  label={t('Healthy models')}
                  value={String(summary.healthy)}
                  hint={t('{{total}} models total', {
                    total: summary.totalModels,
                  })}
                  icon={ShieldCheck}
                  tone='success'
                />
                <SummaryCell
                  label={t('Slow models')}
                  value={String(summary.slow)}
                  hint={t('Last 30 minutes success window')}
                  icon={AlertTriangle}
                  tone='warning'
                />
                <SummaryCell
                  label={t('Faulty models')}
                  value={String(summary.down)}
                  hint={t('Last 30 minutes success window')}
                  icon={AlertTriangle}
                  tone='destructive'
                />
                <SummaryCell
                  label={t('Observing models')}
                  value={String(summary.observing)}
                  hint={t('Not enough request samples')}
                  icon={Eye}
                  tone='chart-4'
                />
              </div>
            )}
          </section>

          {query.isError && (
            <ErrorState
              className='min-h-[200px] border border-dashed'
              title={t('Unable to load group status')}
              description={
                query.error instanceof Error
                  ? query.error.message
                  : t('Please try again later.')
              }
              onRetry={() => void query.refetch()}
            />
          )}

          {!query.isLoading && !query.isError && groups.length === 0 && (
            <EmptyState
              icon={Activity}
              className='min-h-[200px]'
              title={t('No group metrics yet')}
              description={t(
                'Availability is computed from real relay traffic. After models receive requests, success-rate windows will appear here. Ensure performance metrics collection is enabled.'
              )}
            />
          )}

          {groups.map((group) => (
            <section key={group.group} className='space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='text-base font-semibold tracking-tight'>
                  {group.group}
                </h3>
                <span className='text-muted-foreground text-sm'>
                  {t('{{count}} models', { count: group.models.length })}
                </span>
              </div>
              {group.models.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No model traffic in this group during the window.')}
                </p>
              ) : (
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                  {group.models.map((model) => (
                    <ModelStatusCard
                      key={`${group.group}:${model.model}`}
                      model={model}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function SummaryCell(props: {
  label: string
  value: string
  hint: string
  icon: typeof Activity
  tone: IconBadgeTone
}) {
  const Icon = props.icon
  return (
    <div className='min-w-0 px-3 py-3 sm:px-4 sm:py-4'>
      <div className='flex items-center gap-2'>
        <IconBadge tone={props.tone} size='stat'>
          <Icon />
        </IconBadge>
        <span className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
          {props.label}
        </span>
      </div>
      <div className='mt-2 font-mono text-xl font-bold tabular-nums sm:text-2xl'>
        {props.value}
      </div>
      <p className='text-muted-foreground/70 mt-1 hidden text-xs sm:block'>
        {props.hint}
      </p>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className='grid grid-cols-2 gap-0 sm:grid-cols-5'>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className='space-y-2 border-r px-4 py-4 last:border-r-0'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-7 w-12' />
          <Skeleton className='hidden h-3 w-28 sm:block' />
        </div>
      ))}
    </div>
  )
}
