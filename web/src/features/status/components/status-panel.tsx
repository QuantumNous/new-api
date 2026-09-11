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
  Info,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  getSuccessRateDotClass,
  getSuccessRateLevel,
  getSuccessRateTextClass,
  formatLatency,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import { getStatusCheck } from '../api'
import type { HealthLevel, StatusGroup, StatusModel } from '../types'

const LEVEL_RANK: Record<HealthLevel, number> = {
  critical: 0,
  warning: 1,
  good: 2,
  excellent: 3,
}

function sortModels(models: StatusModel[]) {
  return [...models].sort((a, b) => {
    const levelDelta = LEVEL_RANK[a.level] - LEVEL_RANK[b.level]
    if (levelDelta !== 0) return levelDelta
    if (a.ok !== b.ok) return a.ok ? 1 : -1
    return a.availability - b.availability
  })
}

function ModelRow(props: { model: StatusModel }) {
  const { model } = props
  const { t } = useTranslation()
  const rate = Math.round(model.availability * 100) / 100
  const errorText = model.error_msg?.trim()

  return (
    <div className='hover:bg-muted/40 flex flex-col gap-1 px-4 py-2.5 transition-colors sm:px-5'>
      <div className='flex items-center gap-3'>
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            getSuccessRateDotClass(rate)
          )}
        />
        <span className='text-foreground min-w-0 flex-1 truncate text-sm'>
          {model.model}
        </span>
        <span className='text-muted-foreground hidden shrink-0 font-mono text-xs tabular-nums sm:inline'>
          {formatLatency(model.latency_ms)}
        </span>
        <span
          className={cn(
            'w-20 shrink-0 text-right font-mono text-sm font-semibold tabular-nums',
            getSuccessRateTextClass(rate)
          )}
        >
          {Number.isFinite(rate) ? `${rate.toFixed(0)}%` : '—'}
        </span>
      </div>
      {errorText && !model.ok && (
        <p className='text-destructive/80 pl-5 font-mono text-[11px] leading-5'>
          {errorText}
        </p>
      )}
      {!model.has_active && (model.passive_requests ?? 0) > 0 && (
        <p className='text-muted-foreground pl-5 font-mono text-[11px]'>
          {t('Passive traffic only')} · {model.passive_success ?? 0}/
          {model.passive_requests}
        </p>
      )}
    </div>
  )
}

function GroupCard(props: { group: StatusGroup; index: number }) {
  const { group, index } = props
  const { t } = useTranslation()
  const rate = Math.round(group.availability * 100) / 100
  const models = useMemo(() => sortModels(group.models), [group.models])
  const failed = group.models.filter((model) => !model.ok).length

  return (
    <div className='bg-card overflow-hidden rounded-2xl border shadow-xs'>
      <div className='border-b px-4 py-3 sm:px-5'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='text-muted-foreground font-mono text-xs tabular-nums'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className='text-foreground truncate text-sm font-semibold'>
              {group.group}
            </h3>
            {failed > 0 && (
              <span className='text-destructive bg-destructive/10 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase'>
                {t('{{count}} failing', { count: failed })}
              </span>
            )}
          </div>
          <div className='flex shrink-0 items-center gap-3'>
            <span
              className={cn(
                'font-mono text-lg font-semibold tabular-nums',
                getSuccessRateTextClass(rate)
              )}
            >
              {Number.isFinite(rate) ? `${rate.toFixed(0)}%` : '—'}
            </span>
            <span className='text-muted-foreground hidden font-mono text-xs tabular-nums md:inline'>
              {formatLatency(group.avg_latency_ms)}
            </span>
          </div>
        </div>
        <div className='text-muted-foreground mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums'>
          <span>
            {group.ok_probes}/{group.total_probes} {t('probes ok')}
          </span>
          <span>
            {group.models.length} {t('models')}
          </span>
        </div>
        <div className='bg-muted mt-2 h-1 overflow-hidden rounded-full'>
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-700 ease-out',
              getSuccessRateDotClass(rate)
            )}
            style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
          />
        </div>
      </div>
      <div className='divide-border/50 divide-y'>
        {models.length === 0 ? (
          <div className='text-muted-foreground px-4 py-4 text-sm sm:px-5'>
            {t('No models reported')}
          </div>
        ) : (
          models.map((model) => (
            <ModelRow
              key={`${model.model}-${model.channel_id ?? ''}`}
              model={model}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function StatusPanel() {
  const { t } = useTranslation()

  const { data, dataUpdatedAt, isLoading, isError, isFetching, refetch } =
    useQuery({
      queryKey: ['status-check'],
      queryFn: async () => {
        const res = await getStatusCheck()
        return res.data
      },
      refetchInterval: 60_000,
      staleTime: 15_000,
    })

  const announcement = data?.announcement?.trim()
  const groups = data?.groups
  const groupList = groups ?? []
  const hasData = groupList.length > 0
  const summary = useMemo(() => {
    const list = groups ?? []
    const models = list.flatMap((group) => group.models)
    const failing = models.filter((model) => !model.ok).length
    const probes = list.reduce((sum, group) => sum + group.total_probes, 0)
    const okProbes = list.reduce((sum, group) => sum + group.ok_probes, 0)
    const worst = list.reduce<number | null>((min, group) => {
      if (!Number.isFinite(group.availability)) return min
      if (min === null) return group.availability
      return Math.min(min, group.availability)
    }, null)
    return {
      groups: list.length,
      models: models.length,
      failing,
      probes,
      okProbes,
      worst,
    }
  }, [groups])

  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h1 className='text-lg font-semibold'>{t('Channel Status')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Live health of routed models and groups')}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => void refetch()}
          disabled={isFetching}
          className='gap-1.5'
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          {t('Refresh')}
        </Button>
      </div>

      {announcement && (
        <div className='border-border/60 bg-primary/5 rounded-xl border px-4 py-3 text-sm'>
          {announcement}
        </div>
      )}

      {hasData && (
        <div className='grid gap-3 sm:grid-cols-3'>
          <SummaryTile
            icon={<ShieldCheck className='size-3.5' />}
            label={t('Groups')}
            value={String(summary.groups)}
          />
          <SummaryTile
            icon={<Activity className='size-3.5' />}
            label={t('Probes')}
            value={
              summary.probes > 0 ? `${summary.okProbes}/${summary.probes}` : '—'
            }
          />
          <SummaryTile
            icon={<AlertTriangle className='size-3.5' />}
            label={t('Failing models')}
            value={String(summary.failing)}
            tone={
              summary.failing > 0
                ? 'critical'
                : getSuccessRateLevel(summary.worst ?? 100)
            }
          />
        </div>
      )}

      {dataUpdatedAt > 0 && hasData && (
        <p className='text-muted-foreground font-mono text-[11px] tabular-nums'>
          {t('Updated')} {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}

      {renderState()}
    </div>
  )

  function renderState() {
    if (isLoading) {
      return (
        <div className='text-muted-foreground flex items-center gap-2 py-16 text-sm'>
          <Activity className='size-4 animate-pulse' />
          {t('Loading...')}
        </div>
      )
    }
    if (isError) {
      return (
        <div className='text-muted-foreground bg-card rounded-xl border px-4 py-8 text-center text-sm'>
          {t('Failed to load channel status')}
        </div>
      )
    }
    if (!hasData) {
      return (
        <div className='bg-card rounded-xl border px-5 py-10 text-center sm:px-8'>
          <div className='mb-2 text-3xl'>—</div>
          <div className='text-foreground text-sm font-medium'>
            {t('No status monitoring configured')}
          </div>
          <p className='text-muted-foreground mx-auto mt-2 max-w-md text-xs leading-6'>
            {t(
              'Channel health is collected by a scheduled probe. Enable it in the system configuration to see per-group and per-model availability here.'
            )}
          </p>
        </div>
      )
    }
    return (
      <div className='space-y-4'>
        {groupList.map((group, idx) => (
          <GroupCard key={group.group} group={group} index={idx} />
        ))}
        {groupList.every((g) => g.models.length === 0) && (
          <div className='text-muted-foreground/80 flex items-start gap-2 rounded-xl border border-dashed px-4 py-3 text-xs leading-6'>
            <Info className='mt-0.5 size-3.5 shrink-0' />
            <span>
              {t(
                'Groups are configured, but no model probes have run yet. Enable the channel health probe to populate this page.'
              )}
            </span>
          </div>
        )}
      </div>
    )
  }
}

function toneSampleRate(tone: ReturnType<typeof getSuccessRateLevel>) {
  switch (tone) {
    case 'excellent':
      return 100
    case 'good':
      return 90
    case 'warning':
      return 70
    case 'critical':
      return 0
    default:
      return Number.NaN
  }
}

function SummaryTile(props: {
  icon: ReactNode
  label: string
  value: string
  tone?: ReturnType<typeof getSuccessRateLevel>
}) {
  const valueClass = props.tone
    ? getSuccessRateTextClass(toneSampleRate(props.tone))
    : 'text-foreground'

  return (
    <div className='bg-card rounded-xl border px-4 py-3'>
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
        {props.icon}
        {props.label}
      </div>
      <div
        className={cn(
          'mt-1 font-mono text-lg font-semibold tabular-nums',
          valueClass
        )}
      >
        {props.value}
      </div>
    </div>
  )
}
