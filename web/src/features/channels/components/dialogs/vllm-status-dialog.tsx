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
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toIntlLocale } from '@/i18n/languages'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getVLLMStatus } from '../../api'
import {
  vllmMean,
  vllmMetricValue,
  vllmRatio,
  vllmRecentMetrics,
  type VLLMStatus,
} from '../../lib/vllm-status'

type MetricRow = {
  label: string
  value: number | undefined
  unit?: 'percent' | 'seconds' | 'rate'
}

type VLLMStatusDialogProps = {
  channelId: number
  channelName: string
  onClose: () => void
  onSyncModels: () => void
  onTestChannel: () => void
}

// Mounted only while this channel's status dialog is open; unmount aborts the query.
export function VLLMStatusDialog(props: VLLMStatusDialogProps) {
  const { t, i18n } = useTranslation()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const autoRefreshId = useId()
  const previous = useRef<
    { channelId: number; snapshot: VLLMStatus } | undefined
  >(undefined)
  const user = useAuthStore((state) => state.auth.user)
  const canOperate = hasPermission(
    user,
    ADMIN_PERMISSION_RESOURCES.CHANNEL,
    ADMIN_PERMISSION_ACTIONS.OPERATE
  )
  const canSync =
    canOperate &&
    hasPermission(
      user,
      ADMIN_PERMISSION_RESOURCES.CHANNEL,
      ADMIN_PERMISSION_ACTIONS.WRITE
    )
  const query = useQuery({
    queryKey: ['channels', props.channelId, 'vllm-status'],
    queryFn: async ({ signal }) => {
      const snapshot = await getVLLMStatus(props.channelId, signal)
      signal.throwIfAborted()
      const last =
        previous.current?.channelId === props.channelId
          ? previous.current.snapshot
          : undefined
      const recent = vllmRecentMetrics(snapshot, last)
      previous.current = { channelId: props.channelId, snapshot }
      return { snapshot, recent }
    },
    refetchInterval: autoRefresh ? 5000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
    gcTime: 0,
    meta: { errorToast: false },
  })
  const snapshot = query.data?.snapshot
  const metrics = snapshot?.metrics ?? []
  const recent = query.data?.recent
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  })
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
  })
  const seconds = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    maximumFractionDigits: 2,
  })
  const groups: { title: string; hint?: string; rows: MetricRow[] }[] = [
    {
      title: t('Current load'),
      rows: [
        {
          label: t('Running requests'),
          value: vllmMetricValue(metrics, 'vllm:num_requests_running'),
        },
        {
          label: t('Waiting requests'),
          value: vllmMetricValue(metrics, 'vllm:num_requests_waiting'),
        },
        {
          label: t('Peak KV cache usage'),
          value:
            vllmMetricValue(metrics, 'vllm:kv_cache_usage_perc', {}, 'max') ??
            vllmMetricValue(metrics, 'vllm:gpu_cache_usage_perc', {}, 'max'),
          unit: 'percent',
        },
        {
          label: t('Awake engines'),
          value: vllmMetricValue(metrics, 'vllm:engine_sleep_state', {
            sleep_state: 'awake',
          }),
        },
      ],
    },
    {
      title: t('Cumulative usage'),
      hint: t(
        'Counters and averages cover the period since the upstream metrics were initialized or reset.'
      ),
      rows: [
        {
          label: t('Finished requests'),
          value: vllmMetricValue(metrics, 'vllm:request_success_total'),
        },
        {
          label: t('Input tokens'),
          value: vllmMetricValue(metrics, 'vllm:prompt_tokens_total'),
        },
        {
          label: t('Output tokens'),
          value: vllmMetricValue(metrics, 'vllm:generation_tokens_total'),
        },
        {
          label: t('Prefix cache hit rate'),
          value: vllmRatio(
            vllmMetricValue(metrics, 'vllm:prefix_cache_hits_total'),
            vllmMetricValue(metrics, 'vllm:prefix_cache_queries_total')
          ),
          unit: 'percent',
        },
        {
          label: t('Speculative decoding acceptance rate'),
          value: vllmRatio(
            vllmMetricValue(
              metrics,
              'vllm:spec_decode_num_accepted_tokens_total'
            ),
            vllmMetricValue(metrics, 'vllm:spec_decode_num_draft_tokens_total')
          ),
          unit: 'percent',
        },
        {
          label: t('Mean time to first token'),
          value: vllmMean(metrics, 'vllm:time_to_first_token_seconds'),
          unit: 'seconds',
        },
        {
          label: t('Mean request latency'),
          value: vllmMean(metrics, 'vllm:e2e_request_latency_seconds'),
          unit: 'seconds',
        },
        {
          label: t('Mean queue time'),
          value: vllmMean(metrics, 'vllm:request_queue_time_seconds'),
          unit: 'seconds',
        },
        {
          label: t('Mean time per output token'),
          value: vllmMean(
            metrics,
            'vllm:request_time_per_output_token_seconds'
          ),
          unit: 'seconds',
        },
      ],
    },
    {
      title: t('Since previous sample'),
      hint: recent
        ? t('Sample interval: {{seconds}} seconds', {
            seconds: number.format(recent.seconds),
          })
        : t(
            'Waiting for two comparable samples. Counter resets restart the sampling window.'
          ),
      rows: [
        {
          label: t('Input token rate'),
          value: vllmRatio(
            vllmMetricValue(recent?.metrics ?? [], 'vllm:prompt_tokens_total'),
            recent?.seconds
          ),
          unit: 'rate',
        },
        {
          label: t('Output token rate'),
          value: vllmRatio(
            vllmMetricValue(
              recent?.metrics ?? [],
              'vllm:generation_tokens_total'
            ),
            recent?.seconds
          ),
          unit: 'rate',
        },
        {
          label: t('Mean time to first token'),
          value: vllmMean(
            recent?.metrics ?? [],
            'vllm:time_to_first_token_seconds'
          ),
          unit: 'seconds',
        },
        {
          label: t('Mean request latency'),
          value: vllmMean(
            recent?.metrics ?? [],
            'vllm:e2e_request_latency_seconds'
          ),
          unit: 'seconds',
        },
      ],
    },
  ]

  const handleExport = () => {
    if (!snapshot) return
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vllm-${props.channelId}-${snapshot.sampled_at}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('vLLM status')}
      description={props.channelName}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-5'
      footer={
        <Button variant='outline' onClick={props.onClose}>
          {t('Close')}
        </Button>
      }
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          variant='outline'
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('Refresh')}
        </Button>
        <Button
          variant='outline'
          disabled={!canSync}
          onClick={props.onSyncModels}
        >
          {t('Sync models')}
        </Button>
        <Button
          variant='outline'
          disabled={!canOperate}
          onClick={props.onTestChannel}
        >
          {t('Test Connection')}
        </Button>
        <Button variant='outline' disabled={!snapshot} onClick={handleExport}>
          {t('Export snapshot')}
        </Button>
        <div className='flex items-center gap-2'>
          <Switch
            id={autoRefreshId}
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Label htmlFor={autoRefreshId}>{t('Auto refresh (5s)')}</Label>
        </div>
      </div>
      {query.isPending && <LoadingState />}
      {query.isError && !snapshot && (
        <ErrorState
          title={t('Failed to load vLLM status')}
          description={getServerErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isError && snapshot && (
        <Alert variant='destructive'>
          <AlertDescription>
            {t('Refresh failed. Showing the last successful snapshot.')}
          </AlertDescription>
        </Alert>
      )}
      {snapshot && (
        <>
          <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
            <span>
              {t('Version')}:{' '}
              <strong className='break-all'>
                {snapshot.version || t('Unavailable')}
              </strong>
            </span>
            <span>
              {t('Last updated')}:{' '}
              {new Date(snapshot.sampled_at).toLocaleString(locale)}
            </span>
          </div>
          <dl className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-4'>
            {Object.entries(snapshot.endpoints).map(([path, endpoint]) => (
              <div key={path} className='rounded-md border p-2'>
                <dt className='font-mono text-xs'>{path}</dt>
                <dd
                  className={
                    endpoint.error ? 'text-destructive' : 'text-foreground'
                  }
                >
                  {endpoint.error ? t('Unavailable') : t('Available')}
                  {endpoint.status > 0 && ` · HTTP ${endpoint.status}`}
                  {endpoint.error === 'invalid_response' &&
                    ` · ${t('Invalid response')}`}
                  {endpoint.error === 'response_too_large' &&
                    ` · ${t('Response too large')}`}
                </dd>
              </div>
            ))}
          </dl>
          <section className='space-y-2' aria-label={t('Models')}>
            <h3 className='font-medium'>{t('Models')}</h3>
            {snapshot.models.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                {snapshot.endpoints['/v1/models']?.error
                  ? t('Unavailable')
                  : t('No models found')}
              </p>
            )}
            {snapshot.models.map((model) => (
              <div
                key={model.id}
                className='space-y-1 rounded-md border p-3 text-sm'
              >
                <p className='font-medium break-all'>{model.id}</p>
                <p className='text-muted-foreground break-all'>
                  {t('Model source')}: {model.root || t('Unavailable')}
                </p>
                <p>
                  {t('Max context tokens')}:{' '}
                  {model.max_model_len == null
                    ? t('Unavailable')
                    : number.format(model.max_model_len)}
                </p>
              </div>
            ))}
          </section>
          {groups.map((group) => (
            <section
              key={group.title}
              className='space-y-2'
              aria-label={group.title}
            >
              <h3 className='font-medium'>{group.title}</h3>
              {group.hint && (
                <p className='text-muted-foreground text-xs'>{group.hint}</p>
              )}
              <dl className='grid gap-2 sm:grid-cols-2'>
                {group.rows.map((row) => {
                  let value = t('Unavailable')
                  if (row.value !== undefined) {
                    value = number.format(row.value)
                    if (row.unit === 'percent') {
                      value = percent.format(row.value)
                    }
                    if (row.unit === 'seconds') {
                      value = seconds.format(row.value)
                    }
                    if (row.unit === 'rate') {
                      value = t('{{value}} tokens/s', {
                        value: number.format(row.value),
                      })
                    }
                  }
                  return (
                    <div
                      key={row.label}
                      className='flex items-start justify-between gap-4 rounded-md border p-3 text-sm'
                    >
                      <dt className='text-muted-foreground'>{row.label}</dt>
                      <dd className='shrink-0 font-medium tabular-nums'>
                        {value}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          ))}
        </>
      )}
    </Dialog>
  )
}
