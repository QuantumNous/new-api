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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { NumericSpinnerInput } from '@/features/channels/components/numeric-spinner-input'

import {
  listModelRouteMetrics,
  listModelRoutePolicies,
  migrateToModelPriority,
  modelRouteMetricsAction,
  resetAllLearning,
  resetRuntimeLearning,
  updateModelRoutePolicyPriority,
} from './api'
import type { ModelRouteMetrics, ModelRoutePolicy } from './types'

function fmtTs(ts?: number | null) {
  if (!ts) return '—'
  try {
    return new Date(ts * 1000).toLocaleString()
  } catch {
    return String(ts)
  }
}

function fmtNum(v?: number | null, digits = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number(v).toFixed(digits)
}

function formatChannelLabel(channelId: number, channelName?: string) {
  const name = (channelName || '').trim()
  if (name) return `${name} (#${channelId})`
  return `#${channelId}`
}

function localizePolicySource(t: (key: string) => string, source?: string) {
  const s = (source || '').trim().toLowerCase()
  switch (s) {
    case 'configured':
      return t('Configured')
    case 'mapped':
      return t('Mapped')
    case 'observed':
      return t('Observed')
    case 'lazy_created':
      return t('Lazy created')
    default:
      return source || '—'
  }
}

function localizeRouteState(t: (key: string) => string, state?: string) {
  const s = (state || '').trim().toUpperCase()
  switch (s) {
    case 'UNKNOWN':
      return t('UNKNOWN')
    case 'HEALTHY':
      return t('HEALTHY')
    case 'RATE_LIMITED':
      return t('RATE_LIMITED')
    case 'OPEN':
      return t('OPEN')
    case 'PROBING':
      return t('PROBING')
    case 'RECOVERING':
      return t('RECOVERING')
    case 'MANUALLY_DISABLED':
      return t('MANUALLY_DISABLED')
    default:
      return state || '—'
  }
}

function localizeRouteRole(t: (key: string) => string, role?: string) {
  const r = (role || '').trim().toUpperCase()
  switch (r) {
    case 'NONE':
    case '':
      return t('NONE')
    case 'BOOTSTRAP':
      return t('BOOTSTRAP')
    case 'PRIMARY':
      return t('PRIMARY')
    case 'OVERFLOW':
      return t('OVERFLOW')
    default:
      return role || t('NONE')
  }
}

function includesIgnoreCase(haystack: string | undefined, needle: string) {
  if (!needle) return true
  return (haystack || '').toLowerCase().includes(needle.toLowerCase())
}

function PolicyPriorityCell({
  row,
  disabled,
  onChange,
}: {
  row: ModelRoutePolicy
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <NumericSpinnerInput
      value={row.manual_priority ?? 0}
      onChange={onChange}
      min={-999}
      max={9999}
      disabled={disabled}
    />
  )
}

export function ModelRouteAdmin() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'policies' | 'metrics'>('policies')
  const [modelKeyword, setModelKeyword] = useState('')
  const [channelFilter, setChannelFilter] = useState('')

  // Always load full lists; filter client-side for substring match (e.g. "4.5" → grok-4.5).
  const policyQuery = useQuery({
    queryKey: ['model-route-policies'],
    queryFn: () => listModelRoutePolicies(),
  })

  const metricsQuery = useQuery({
    queryKey: ['model-route-metrics'],
    queryFn: () => listModelRouteMetrics(),
  })

  const migrateMut = useMutation({
    mutationFn: migrateToModelPriority,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Migration failed'))
        return
      }
      toast.success(t('Migrated to model priority'))
      void qc.invalidateQueries({ queryKey: ['model-route-policies'] })
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
      void qc.invalidateQueries({ queryKey: ['system-options'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const priorityMut = useMutation({
    mutationFn: updateModelRoutePolicyPriority,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Update failed'))
        return
      }
      toast.success(t('Priority updated'))
      void qc.invalidateQueries({ queryKey: ['model-route-policies'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMut = useMutation({
    mutationFn: modelRouteMetricsAction,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Action failed'))
        return
      }
      toast.success(t('Action applied'))
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetRuntimeMut = useMutation({
    mutationFn: resetRuntimeLearning,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Reset failed'))
        return
      }
      toast.success(t('Runtime learning reset'))
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetAllMut = useMutation({
    mutationFn: resetAllLearning,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Reset failed'))
        return
      }
      toast.success(t('All learning reset'))
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const channelKeyword = channelFilter.trim()
  const modelKw = modelKeyword.trim()

  const policies = useMemo(() => {
    const rows = [...(policyQuery.data?.data ?? [])]
    const filtered = rows.filter((row) => {
      if (channelKeyword) {
        const idMatch = String(row.channel_id).includes(channelKeyword)
        const nameMatch = includesIgnoreCase(row.channel_name, channelKeyword)
        if (!idMatch && !nameMatch) return false
      }
      if (modelKw && !includesIgnoreCase(row.requested_model, modelKw)) {
        return false
      }
      return true
    })
    filtered.sort((a, b) => {
      if (a.manual_priority !== b.manual_priority) {
        return b.manual_priority - a.manual_priority
      }
      if (a.channel_id !== b.channel_id) {
        return a.channel_id - b.channel_id
      }
      return a.requested_model.localeCompare(b.requested_model)
    })
    return filtered
  }, [policyQuery.data, channelKeyword, modelKw])

  const metrics = useMemo(() => {
    const rows = [...(metricsQuery.data?.data ?? [])]
    const filtered = rows.filter((row) => {
      if (channelKeyword) {
        const idMatch = String(row.channel_id).includes(channelKeyword)
        const nameMatch = includesIgnoreCase(row.channel_name, channelKeyword)
        if (!idMatch && !nameMatch) return false
      }
      if (modelKw && !includesIgnoreCase(row.effective_model, modelKw)) {
        return false
      }
      return true
    })
    filtered.sort((a, b) => {
      if (a.channel_id !== b.channel_id) {
        return a.channel_id - b.channel_id
      }
      return a.effective_model.localeCompare(b.effective_model)
    })
    return filtered
  }, [metricsQuery.data, channelKeyword, modelKw])

  const isRefreshing = policyQuery.isFetching || metricsQuery.isFetching

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Model Route')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative'>
            <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
            <Input
              className='h-8 w-40 pl-8 text-sm'
              placeholder={t('Channel name or ID')}
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            />
          </div>
          <div className='relative'>
            <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
            <Input
              className='h-8 w-48 pl-8 text-sm'
              placeholder={t('Search model...')}
              value={modelKeyword}
              onChange={(e) => setModelKeyword(e.target.value)}
            />
          </div>
          <Button
            variant='outline'
            size='sm'
            className='h-8'
            disabled={isRefreshing}
            onClick={() => {
              void policyQuery.refetch()
              void metricsQuery.refetch()
            }}
          >
            <RefreshCw
              className={cn('mr-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')}
            />
            {t('Refresh')}
          </Button>
          <Button
            variant='secondary'
            size='sm'
            className='h-8'
            disabled={migrateMut.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  t(
                    'Migrate to model-level priority? This zeros channel priority/weight and enables model_priority mode.'
                  )
                )
              ) {
                return
              }
              migrateMut.mutate()
            }}
          >
            {t('Migrate to model priority')}
          </Button>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'policies' | 'metrics')}
        >
          <TabsList>
            <TabsTrigger value='policies'>{t('Policies')}</TabsTrigger>
            <TabsTrigger value='metrics'>{t('Metrics')}</TabsTrigger>
          </TabsList>

          <TabsContent value='policies' className='mt-4'>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[760px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Channel')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Requested model')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Priority')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Enabled')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Source')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((row: ModelRoutePolicy) => (
                    <tr
                      key={`${row.channel_id}:${row.requested_model}`}
                      className='hover:bg-muted/30 border-t transition-colors'
                    >
                      <td className='p-2.5'>
                        <div className='flex min-w-0 flex-col gap-0.5'>
                          <span className='truncate font-medium'>
                            {formatChannelLabel(row.channel_id, row.channel_name)}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            ID: {row.channel_id}
                          </span>
                        </div>
                      </td>
                      <td className='p-2.5 font-mono text-xs'>
                        {row.requested_model}
                      </td>
                      <td className='p-2.5'>
                        <PolicyPriorityCell
                          row={row}
                          disabled={priorityMut.isPending}
                          onChange={(value) => {
                            if (value === row.manual_priority) return
                            priorityMut.mutate({
                              channel_id: row.channel_id,
                              requested_model: row.requested_model,
                              manual_priority: value,
                            })
                          }}
                        />
                      </td>
                      <td className='p-2.5'>
                        {row.enabled ? (
                          <Badge variant='secondary'>{t('Yes')}</Badge>
                        ) : (
                          <Badge variant='outline'>{t('No')}</Badge>
                        )}
                      </td>
                      <td className='p-2.5'>
                        <Badge variant='outline' className='font-normal'>
                          {localizePolicySource(t, row.source)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!policyQuery.isLoading && policies.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className='text-muted-foreground p-6 text-center'
                      >
                        {t('No policies')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!policyQuery.isLoading && policies.length > 0 && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('{{count}} policies', { count: policies.length })}
              </p>
            )}
          </TabsContent>

          <TabsContent value='metrics' className='mt-4 space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[980px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Channel')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Effective model')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('State')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Role')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Score')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Success EMA')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('TTFT EMA')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Stale')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Last success')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row: ModelRouteMetrics) => (
                    <tr
                      key={`${row.channel_id}:${row.effective_model}`}
                      className='hover:bg-muted/30 border-t transition-colors'
                    >
                      <td className='p-2.5'>
                        <div className='flex min-w-0 flex-col gap-0.5'>
                          <span className='truncate font-medium'>
                            {formatChannelLabel(row.channel_id, row.channel_name)}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            ID: {row.channel_id}
                          </span>
                        </div>
                      </td>
                      <td className='p-2.5 font-mono text-xs'>
                        {row.effective_model}
                      </td>
                      <td className='p-2.5'>
                        <Badge variant='outline' className='font-normal'>
                          {localizeRouteState(t, row.route_state)}
                        </Badge>
                      </td>
                      <td className='p-2.5'>
                        {localizeRouteRole(t, row.role)}
                      </td>
                      <td className='p-2.5 tabular-nums'>
                        {fmtNum(row.experience_score)}
                      </td>
                      <td className='p-2.5 tabular-nums'>
                        {fmtNum(row.production_success_ema)}
                      </td>
                      <td className='p-2.5 tabular-nums'>
                        {fmtNum(row.production_ttft_ema_ms, 1)}
                      </td>
                      <td className='p-2.5'>
                        {row.is_stale ? (
                          <Badge variant='destructive'>{t('Stale')}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className='text-muted-foreground p-2.5 text-xs'>
                        {fmtTs(row.last_success_at)}
                      </td>
                      <td className='p-2.5'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <Select
                            onValueChange={(action) => {
                              if (
                                !action ||
                                ![
                                  'trip_open',
                                  'force_probe',
                                  'manual_disable',
                                  'restore_auto',
                                ].includes(action)
                              ) {
                                return
                              }
                              actionMut.mutate({
                                channel_id: row.channel_id,
                                effective_model: row.effective_model,
                                action: action as
                                  | 'trip_open'
                                  | 'force_probe'
                                  | 'manual_disable'
                                  | 'restore_auto',
                              })
                            }}
                          >
                            <SelectTrigger className='h-8 w-36'>
                              <SelectValue placeholder={t('Action')} />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectGroup>
                                <SelectItem value='force_probe'>
                                  {t('Force probe')}
                                </SelectItem>
                                <SelectItem value='trip_open'>
                                  {t('Trip open')}
                                </SelectItem>
                                <SelectItem value='manual_disable'>
                                  {t('Manual disable')}
                                </SelectItem>
                                <SelectItem value='restore_auto'>
                                  {t('Restore auto')}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-8'
                            onClick={() =>
                              resetRuntimeMut.mutate({
                                channel_id: row.channel_id,
                                effective_model: row.effective_model,
                              })
                            }
                          >
                            {t('Reset runtime')}
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            className='h-8'
                            onClick={() => {
                              if (
                                !window.confirm(
                                  t(
                                    'Reset ALL learning for this metrics key? This cannot be undone.'
                                  )
                                )
                              ) {
                                return
                              }
                              resetAllMut.mutate({
                                channel_id: row.channel_id,
                                effective_model: row.effective_model,
                                confirm: true,
                              })
                            }}
                          >
                            {t('Reset all')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!metricsQuery.isLoading && metrics.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className='text-muted-foreground p-6 text-center'
                      >
                        {t('No metrics')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!metricsQuery.isLoading && metrics.length > 0 && (
              <p className='text-muted-foreground text-xs'>
                {t('{{count}} metrics', { count: metrics.length })}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
