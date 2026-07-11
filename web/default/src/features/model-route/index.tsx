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


function formatChannelLabel(channelId: number, channelName?: string) {
  const name = (channelName || '').trim()
  if (name) return `${name} (#${channelId})`
  return `#${channelId}`
}

function fmtNum(v?: number | null, digits = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number(v).toFixed(digits)
}

export function ModelRouteAdmin() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'policies' | 'metrics'>('policies')
  const [requestedModel, setRequestedModel] = useState('')
  const [channelFilter, setChannelFilter] = useState('')

  const policyQuery = useQuery({
    queryKey: ['model-route-policies', requestedModel, channelFilter],
    queryFn: () =>
      listModelRoutePolicies({
        requested_model: requestedModel.trim() || undefined,
        channel_id: channelFilter ? Number(channelFilter) : undefined,
      }),
  })

  const metricsQuery = useQuery({
    queryKey: ['model-route-metrics', channelFilter],
    queryFn: () =>
      listModelRouteMetrics({
        channel_id: channelFilter ? Number(channelFilter) : undefined,
      }),
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

  const policies = useMemo(
    () => policyQuery.data?.data ?? [],
    [policyQuery.data]
  )
  const metrics = useMemo(
    () => metricsQuery.data?.data ?? [],
    [metricsQuery.data]
  )

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Model Route')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            className='w-40'
            placeholder={t('Channel ID')}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          />
          {tab === 'policies' && (
            <Input
              className='w-48'
              placeholder={t('Requested model')}
              value={requestedModel}
              onChange={(e) => setRequestedModel(e.target.value)}
            />
          )}
          <Button
            variant='outline'
            onClick={() => {
              void policyQuery.refetch()
              void metricsQuery.refetch()
            }}
          >
            {t('Refresh')}
          </Button>
          <Button
            variant='secondary'
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
              <table className='w-full min-w-[720px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='p-2'>{t('Channel')}</th>
                    <th className='p-2'>{t('Requested model')}</th>
                    <th className='p-2'>{t('Priority')}</th>
                    <th className='p-2'>{t('Enabled')}</th>
                    <th className='p-2'>{t('Source')}</th>
                    <th className='p-2'>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((row: ModelRoutePolicy) => (
                    <tr
                      key={`${row.channel_id}:${row.requested_model}`}
                      className='border-t'
                    >
                      <td className='p-2'>
                        <div className='flex flex-col gap-0.5'>
                          <span className='font-medium'>
                            {formatChannelLabel(row.channel_id, row.channel_name)}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            ID: {row.channel_id}
                          </span>
                        </div>
                      </td>
                      <td className='p-2 font-mono text-xs'>
                        {row.requested_model}
                      </td>
                      <td className='p-2'>{row.manual_priority}</td>
                      <td className='p-2'>
                        {row.enabled ? (
                          <Badge variant='secondary'>{t('Yes')}</Badge>
                        ) : (
                          <Badge variant='outline'>{t('No')}</Badge>
                        )}
                      </td>
                      <td className='p-2'>{row.source}</td>
                      <td className='p-2'>
                        <div className='flex items-center gap-1'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => {
                              const raw = window.prompt(
                                t('New manual priority'),
                                String(row.manual_priority)
                              )
                              if (raw == null) return
                              const n = Number(raw)
                              if (Number.isNaN(n)) {
                                toast.error(t('Invalid number'))
                                return
                              }
                              priorityMut.mutate({
                                channel_id: row.channel_id,
                                requested_model: row.requested_model,
                                manual_priority: n,
                              })
                            }}
                          >
                            {t('Edit priority')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!policyQuery.isLoading && policies.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className='text-muted-foreground p-4 text-center'
                      >
                        {t('No policies')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value='metrics' className='mt-4 space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full min-w-[980px] text-sm'>
                <thead className='bg-muted/40 text-left'>
                  <tr>
                    <th className='p-2'>{t('Channel')}</th>
                    <th className='p-2'>{t('Effective model')}</th>
                    <th className='p-2'>{t('State')}</th>
                    <th className='p-2'>{t('Role')}</th>
                    <th className='p-2'>{t('Score')}</th>
                    <th className='p-2'>{t('Success EMA')}</th>
                    <th className='p-2'>{t('TTFT EMA')}</th>
                    <th className='p-2'>{t('Stale')}</th>
                    <th className='p-2'>{t('Last success')}</th>
                    <th className='p-2'>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row: ModelRouteMetrics) => (
                    <tr
                      key={`${row.channel_id}:${row.effective_model}`}
                      className='border-t'
                    >
                      <td className='p-2'>
                        <div className='flex flex-col gap-0.5'>
                          <span className='font-medium'>
                            {formatChannelLabel(row.channel_id, row.channel_name)}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            ID: {row.channel_id}
                          </span>
                        </div>
                      </td>
                      <td className='p-2 font-mono text-xs'>
                        {row.effective_model}
                      </td>
                      <td className='p-2'>{row.route_state}</td>
                      <td className='p-2'>{row.role || '—'}</td>
                      <td className='p-2'>{fmtNum(row.experience_score)}</td>
                      <td className='p-2'>
                        {fmtNum(row.production_success_ema)}
                      </td>
                      <td className='p-2'>
                        {fmtNum(row.production_ttft_ema_ms, 1)}
                      </td>
                      <td className='p-2'>
                        {row.is_stale ? (
                          <Badge variant='destructive'>{t('Stale')}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className='p-2'>{fmtTs(row.last_success_at)}</td>
                      <td className='p-2'>
                        <div className='flex flex-wrap gap-1'>
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
                        className='text-muted-foreground p-4 text-center'
                      >
                        {t('No metrics')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
