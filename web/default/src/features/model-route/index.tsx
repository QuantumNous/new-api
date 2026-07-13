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
import { Checkbox } from '@/components/ui/checkbox'
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
  pruneModelRouteOrphans,
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

function normalizeExternalUrl(raw?: string) {
  const value = (raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^\/\//.test(value)) return `https:${value}`
  // bare host / path-like base_url from channel config
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(value)) {
    return `https://${value}`
  }
  return ''
}

function ChannelNameLink({
  channelId,
  channelName,
  baseUrl,
}: {
  channelId: number
  channelName?: string
  baseUrl?: string
}) {
  const label = formatChannelLabel(channelId, channelName)
  const href = normalizeExternalUrl(baseUrl)
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      {href ? (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='decoration-foreground/30 hover:decoration-foreground truncate font-medium underline decoration-1 underline-offset-4 transition-colors'
          title={href}
        >
          {label}
        </a>
      ) : (
        <span className='truncate font-medium' title={label}>
          {label}
        </span>
      )}
      <span className='text-muted-foreground text-xs'>ID: {channelId}</span>
    </div>
  )
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

function matchesModelSearch(
  value: string | undefined,
  keyword: string,
  exact: boolean
) {
  if (!keyword) return true
  if (exact) return (value || '') === keyword
  return includesIgnoreCase(value, keyword)
}

function matchesAnyModelSearch(
  values: Array<string | undefined>,
  keyword: string,
  exact: boolean
) {
  if (!keyword) return true
  return values.some((v) => matchesModelSearch(v, keyword, exact))
}

function metricsRowKey(row: Pick<ModelRouteMetrics, 'channel_id' | 'effective_model'>) {
  return `${row.channel_id}:${row.effective_model}`
}

type MetricsAction =
  | 'trip_open'
  | 'force_probe'
  | 'manual_disable'
  | 'restore_auto'

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
  const [exactModelMatch, setExactModelMatch] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchActionKey, setBatchActionKey] = useState(0)
  const [rowActionKey, setRowActionKey] = useState(0)
  const [priorityBusy, setPriorityBusy] = useState(false)

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

  const pruneMut = useMutation({
    mutationFn: pruneModelRouteOrphans,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Prune failed'))
        return
      }
      const policies = res.data?.policies_deleted ?? 0
      const metrics = res.data?.metrics_deleted ?? 0
      toast.success(
        t('Pruned {{policies}} policies and {{metrics}} metrics', {
          policies,
          metrics,
        })
      )
      void qc.invalidateQueries({ queryKey: ['model-route-policies'] })
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handlePruneOrphans = async () => {
    if (pruneMut.isPending) return
    try {
      const preview = await pruneModelRouteOrphans({ dry_run: true })
      if (!preview.success) {
        toast.error(preview.message || t('Prune failed'))
        return
      }
      const policies = preview.data?.policies_deleted ?? 0
      const metrics = preview.data?.metrics_deleted ?? 0
      if (policies === 0 && metrics === 0) {
        toast.success(t('No orphan policies to prune'))
        return
      }
      if (
        !window.confirm(
          t(
            'Delete {{policies}} orphan policies and {{metrics}} orphan metrics? Only configured/mapped policies no longer declared by channel models/mapping will be removed.',
            { policies, metrics }
          )
        )
      ) {
        return
      }
      pruneMut.mutate({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Prune failed'))
    }
  }

  const handlePriorityChange = async (
    row: ModelRoutePolicy,
    value: number
  ) => {
    const oldValue = row.manual_priority ?? 0
    if (value === oldValue || priorityBusy) return

    // Uniqueness scope: same requested_model only.
    const all = policyQuery.data?.data ?? []
    const conflict = all.find(
      (p) =>
        p.requested_model === row.requested_model &&
        p.channel_id !== row.channel_id &&
        (p.manual_priority ?? 0) === value
    )

    setPriorityBusy(true)
    try {
      if (conflict) {
        // Free the target priority first, then assign; rollback on second failure.
        const resConflict = await updateModelRoutePolicyPriority({
          channel_id: conflict.channel_id,
          requested_model: conflict.requested_model,
          manual_priority: oldValue,
        })
        if (!resConflict.success) {
          toast.error(resConflict.message || t('Update failed'))
          return
        }
        const resCurrent = await updateModelRoutePolicyPriority({
          channel_id: row.channel_id,
          requested_model: row.requested_model,
          manual_priority: value,
        })
        if (!resCurrent.success) {
          try {
            await updateModelRoutePolicyPriority({
              channel_id: conflict.channel_id,
              requested_model: conflict.requested_model,
              manual_priority: value,
            })
          } catch {
            // best-effort rollback
          }
          toast.error(resCurrent.message || t('Update failed'))
          return
        }
        toast.success(
          t('Priority swapped with {{channel}}', {
            channel: formatChannelLabel(
              conflict.channel_id,
              conflict.channel_name
            ),
          })
        )
      } else {
        const res = await updateModelRoutePolicyPriority({
          channel_id: row.channel_id,
          requested_model: row.requested_model,
          manual_priority: value,
        })
        if (!res.success) {
          toast.error(res.message || t('Update failed'))
          return
        }
        toast.success(t('Priority updated'))
      }
      void qc.invalidateQueries({ queryKey: ['model-route-policies'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Update failed'))
    } finally {
      setPriorityBusy(false)
    }
  }

  const actionMut = useMutation({
    mutationFn: modelRouteMetricsAction,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Action failed'))
        return
      }
      toast.success(t('Action applied'))
      setRowActionKey((v) => v + 1)
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
      if (
        !matchesAnyModelSearch(
          [row.requested_model, row.effective_model],
          modelKw,
          exactModelMatch
        )
      ) {
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
  }, [policyQuery.data, channelKeyword, modelKw, exactModelMatch])

  const metrics = useMemo(() => {
    const rows = [...(metricsQuery.data?.data ?? [])]
    const filtered = rows.filter((row) => {
      if (channelKeyword) {
        const idMatch = String(row.channel_id).includes(channelKeyword)
        const nameMatch = includesIgnoreCase(row.channel_name, channelKeyword)
        if (!idMatch && !nameMatch) return false
      }
      const modelValues = [
        row.effective_model,
        ...(row.requested_models ?? []),
      ]
      if (!matchesAnyModelSearch(modelValues, modelKw, exactModelMatch)) {
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
  }, [metricsQuery.data, channelKeyword, modelKw, exactModelMatch])

  const selectedMetrics = useMemo(
    () => metrics.filter((row) => selectedMetricKeys.has(metricsRowKey(row))),
    [metrics, selectedMetricKeys]
  )

  const allVisibleSelected =
    metrics.length > 0 && selectedMetrics.length === metrics.length
  const someVisibleSelected =
    selectedMetrics.length > 0 && selectedMetrics.length < metrics.length

  const toggleMetricSelected = (key: string, checked: boolean) => {
    setSelectedMetricKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedMetricKeys((prev) => {
      const next = new Set(prev)
      for (const row of metrics) {
        const key = metricsRowKey(row)
        if (checked) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }

  const clearMetricSelection = () => setSelectedMetricKeys(new Set())

  const runOnSelectedMetrics = async (
    label: string,
    confirmText: string,
    runner: (row: ModelRouteMetrics) => Promise<{ success: boolean; message?: string }>
  ) => {
    if (selectedMetrics.length === 0 || batchBusy) return
    if (!window.confirm(confirmText)) return

    setBatchBusy(true)
    let ok = 0
    let failed = 0
    try {
      for (const row of selectedMetrics) {
        try {
          const res = await runner(row)
          if (res.success) ok += 1
          else failed += 1
        } catch {
          failed += 1
        }
      }
      if (failed === 0) {
        toast.success(
          t('{{action}} applied to {{count}} metrics', {
            action: label,
            count: ok,
          })
        )
        clearMetricSelection()
      } else {
        toast.error(
          t('{{action}}: {{ok}} succeeded, {{failed}} failed', {
            action: label,
            ok,
            failed,
          })
        )
      }
      void qc.invalidateQueries({ queryKey: ['model-route-metrics'] })
    } finally {
      setBatchBusy(false)
      setBatchActionKey((v) => v + 1)
    }
  }

  const isRefreshing = policyQuery.isFetching || metricsQuery.isFetching
  const rowActionDisabled = batchBusy

  const handleRefresh = async () => {
    if (isRefreshing) return
    try {
      const results = await Promise.all([
        policyQuery.refetch({ cancelRefetch: false }),
        metricsQuery.refetch({ cancelRefetch: false }),
      ])
      const failed = results.some((r) => r.isError || r.error)
      if (failed) {
        toast.error(t('Refresh failed'))
        return
      }
      setRowActionKey((v) => v + 1)
      setBatchActionKey((v) => v + 1)
      toast.success(t('Refreshed'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Refresh failed'))
    }
  }

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
          <label className='text-muted-foreground flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs select-none'>
            <Checkbox
              checked={exactModelMatch}
              onCheckedChange={(value) => setExactModelMatch(value === true)}
              aria-label={t('Exact match')}
            />
            <span>{t('Exact match')}</span>
          </label>
          <Button
            variant='outline'
            size='sm'
            className='h-8'
            disabled={isRefreshing}
            onClick={() => {
              void handleRefresh()
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
          <Button
            variant='outline'
            size='sm'
            className='h-8'
            disabled={pruneMut.isPending}
            onClick={() => {
              void handlePruneOrphans()
            }}
          >
            {t('Clean invalid policies')}
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
              <table className='w-full min-w-[860px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Channel')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Requested model')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Effective model')}
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
                  {policies.map((row: ModelRoutePolicy) => {
                    const effective =
                      row.effective_model || row.requested_model
                    const mapped =
                      effective !== '' && effective !== row.requested_model
                    return (
                      <tr
                        key={`${row.channel_id}:${row.requested_model}`}
                        className='hover:bg-muted/30 border-t transition-colors'
                      >
                        <td className='p-2.5'>
                          <ChannelNameLink
                            channelId={row.channel_id}
                            channelName={row.channel_name}
                            baseUrl={row.base_url}
                          />
                        </td>
                        <td className='p-2.5 font-mono text-xs'>
                          {row.requested_model}
                        </td>
                        <td className='p-2.5 font-mono text-xs'>
                          {mapped ? (
                            <span title={`${row.requested_model} → ${effective}`}>
                              <span className='text-muted-foreground'>→ </span>
                              {effective}
                            </span>
                          ) : (
                            <span className='text-muted-foreground'>
                              {effective || '—'}
                            </span>
                          )}
                        </td>
                        <td className='p-2.5'>
                          <PolicyPriorityCell
                            row={row}
                            disabled={priorityBusy}
                            onChange={(value) => {
                              void handlePriorityChange(row, value)
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
                    )
                  })}
                  {!policyQuery.isLoading && policies.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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
            {selectedMetrics.length > 0 && (
              <div className='bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2'>
                <span className='text-muted-foreground text-xs'>
                  {t('{{count}} selected', { count: selectedMetrics.length })}
                </span>
                <Select
                  key={batchActionKey}
                  disabled={batchBusy}
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
                    const typed = action as MetricsAction
                    const labelMap: Record<MetricsAction, string> = {
                      force_probe: t('Force probe'),
                      trip_open: t('Trip open'),
                      manual_disable: t('Manual disable'),
                      restore_auto: t('Restore auto'),
                    }
                    const confirmMap: Record<MetricsAction, string> = {
                      force_probe: t(
                        'Confirm force probe for {{count}} selected metrics?',
                        { count: selectedMetrics.length }
                      ),
                      trip_open: t(
                        'Confirm trip open for {{count}} selected metrics?',
                        { count: selectedMetrics.length }
                      ),
                      manual_disable: t(
                        'Confirm manual disable for {{count}} selected metrics?',
                        { count: selectedMetrics.length }
                      ),
                      restore_auto: t(
                        'Confirm restore auto for {{count}} selected metrics?',
                        { count: selectedMetrics.length }
                      ),
                    }
                    void runOnSelectedMetrics(
                      labelMap[typed],
                      confirmMap[typed],
                      (row) =>
                        modelRouteMetricsAction({
                          channel_id: row.channel_id,
                          effective_model: row.effective_model,
                          action: typed,
                        })
                    )
                  }}
                >
                  <SelectTrigger className='h-8 w-40'>
                    <SelectValue placeholder={t('Batch action')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value='force_probe'>
                        {t('Force probe')}
                      </SelectItem>
                      <SelectItem value='trip_open'>{t('Trip open')}</SelectItem>
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
                  disabled={batchBusy}
                  onClick={() =>
                    void runOnSelectedMetrics(
                      t('Reset runtime'),
                      t(
                        'Confirm reset runtime for {{count}} selected metrics?',
                        { count: selectedMetrics.length }
                      ),
                      (row) =>
                        resetRuntimeLearning({
                          channel_id: row.channel_id,
                          effective_model: row.effective_model,
                        })
                    )
                  }
                >
                  {t('Reset runtime')}
                </Button>
                <Button
                  size='sm'
                  variant='destructive'
                  className='h-8'
                  disabled={batchBusy}
                  onClick={() =>
                    void runOnSelectedMetrics(
                      t('Reset all'),
                      t(
                        'Reset ALL learning for {{count}} selected metrics? This cannot be undone.',
                        { count: selectedMetrics.length }
                      ),
                      (row) =>
                        resetAllLearning({
                          channel_id: row.channel_id,
                          effective_model: row.effective_model,
                          confirm: true,
                        })
                    )
                  }
                >
                  {t('Reset all')}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-8'
                  disabled={batchBusy}
                  onClick={clearMetricSelection}
                >
                  {t('Clear selection')}
                </Button>
              </div>
            )}
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[1080px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='text-muted-foreground w-10 p-2.5 font-medium'>
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected}
                        onCheckedChange={(value) =>
                          toggleSelectAllVisible(value === true)
                        }
                        disabled={metrics.length === 0 || batchBusy}
                        aria-label={t('Select all')}
                      />
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Channel')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Effective model')}
                    </th>
                    <th className='text-muted-foreground p-2.5 font-medium'>
                      {t('Requested models')}
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
                  {metrics.map((row: ModelRouteMetrics) => {
                    const key = metricsRowKey(row)
                    const selected = selectedMetricKeys.has(key)
                    const requestedModels = row.requested_models ?? []
                    return (
                      <tr
                        key={key}
                        className={cn(
                          'hover:bg-muted/30 border-t transition-colors',
                          selected && 'bg-muted/20'
                        )}
                      >
                        <td className='p-2.5'>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(value) =>
                              toggleMetricSelected(key, value === true)
                            }
                            disabled={batchBusy}
                            aria-label={t('Select row')}
                          />
                        </td>
                        <td className='p-2.5'>
                          <ChannelNameLink
                            channelId={row.channel_id}
                            channelName={row.channel_name}
                            baseUrl={row.base_url}
                          />
                        </td>
                        <td className='p-2.5 font-mono text-xs'>
                          {row.effective_model}
                        </td>
                        <td className='p-2.5'>
                          {requestedModels.length > 0 ? (
                            <div className='flex max-w-[220px] flex-wrap gap-1'>
                              {requestedModels.map((name) => (
                                <Badge
                                  key={name}
                                  variant='outline'
                                  className='font-mono text-[10px] font-normal'
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
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
                              key={`${key}:${rowActionKey}`}
                              disabled={rowActionDisabled}
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
                                  action: action as MetricsAction,
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
                              disabled={rowActionDisabled}
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
                              disabled={rowActionDisabled}
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
                    )
                  })}
                  {!metricsQuery.isLoading && metrics.length === 0 && (
                    <tr>
                      <td
                        colSpan={12}
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
