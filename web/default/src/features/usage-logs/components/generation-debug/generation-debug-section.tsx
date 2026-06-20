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
import {
  CircleDollarSignIcon,
  Clock3Icon,
  DatabaseIcon,
  FingerprintIcon,
  HashIcon,
  LayersIcon,
  RefreshCcwIcon,
  RouteIcon,
  ZapIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { CompletionDebugPanel } from './completion-debug-panel'
import { PromptDebugPanel } from './prompt-debug-panel'
import { RawDebugPanel } from './raw-debug-panel'
import {
  finishReasonLabel,
  formatGenerationCost,
  formatGenerationLatency,
  formatGenerationThroughput,
  formatGenerationTokens,
} from './utils'

interface GenerationDebugSectionProps {
  log: UsageLog
  other: LogOtherData | null
  isAdmin: boolean
}

interface MetricCardProps {
  label: string
  value: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  muted?: boolean
  mono?: boolean
}

function MetricCard(props: MetricCardProps) {
  const Icon = props.icon
  return (
    <Card size='sm' className='gap-1 py-2.5'>
      <CardHeader className='flex-row items-center gap-1.5 px-3'>
        <Icon className='text-muted-foreground size-3.5' aria-hidden />
        <CardTitle className='text-muted-foreground text-[11px] font-medium'>
          {props.label}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          'min-w-0 break-words px-3 text-sm font-semibold',
          props.mono && 'font-mono text-xs',
          props.muted && 'text-muted-foreground'
        )}
      >
        {props.value}
      </CardContent>
    </Card>
  )
}

export function GenerationDebugSection(props: GenerationDebugSectionProps) {
  const { t } = useTranslation()
  const summary = props.other?.generation_debug
  const raw = props.isAdmin
    ? props.other?.admin_info?.generation_debug_raw
    : undefined

  if (!summary) return null

  const rawResponse = raw?.raw_stream ?? raw?.raw_response
  const rawRequest = raw?.upstream_request ?? raw?.inbound_request
  const retryChain = props.other?.admin_info?.use_channel ?? []
  const fallbackCount = Math.max(0, retryChain.length - 1)
  const cachedTokens = summary.cache?.cached_tokens ?? 0
  let providerName = '--'
  if (props.log.channel_name) {
    providerName = `${props.log.channel_name} #${props.log.channel}`
  } else if (props.log.channel > 0) {
    providerName = `#${props.log.channel}`
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-semibold'>{t('Generation Debug')}</span>
        <span className='text-muted-foreground text-[11px]'>
          {summary.streaming ? t('Streaming') : t('Non-streaming')}
        </span>
      </div>

      <div className='grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5'>
        <MetricCard
          label={t('Model')}
          value={
            props.other?.upstream_model_name || props.log.model_name || '--'
          }
          icon={LayersIcon}
          mono
        />
        <MetricCard
          label={t('Provider')}
          value={providerName}
          icon={HashIcon}
          mono
          muted={providerName === '--'}
        />
        <MetricCard
          label={t('Request ID')}
          value={summary.request_id || props.log.request_id || '--'}
          icon={FingerprintIcon}
          mono
          muted={!summary.request_id && !props.log.request_id}
        />
        <MetricCard
          label={t('Generation ID')}
          value={summary.generation_id || '--'}
          icon={FingerprintIcon}
          mono
          muted={!summary.generation_id}
        />
        <MetricCard
          label={t('Finish Reason')}
          value={finishReasonLabel(
            summary.finish_reason || summary.completion?.finish_reason,
            t
          )}
          icon={RouteIcon}
          mono
          muted={!summary.finish_reason && !summary.completion?.finish_reason}
        />
        <MetricCard
          label={t('Streaming')}
          value={summary.streaming ? t('Yes') : t('No')}
          icon={ZapIcon}
        />
        <MetricCard
          label={t('Provider latency')}
          value={formatGenerationLatency(summary.provider_latency_ms)}
          icon={Clock3Icon}
        />
        <MetricCard
          label={t('Throughput')}
          value={formatGenerationThroughput(
            summary.throughput_tokens_per_second
          )}
          icon={ZapIcon}
        />
        <MetricCard
          label={t('Cost')}
          value={formatGenerationCost(
            summary.provider_cost ?? summary.cost,
            summary.charged_cost
          )}
          icon={CircleDollarSignIcon}
        />
        <MetricCard
          label={t('Tokens')}
          value={`${formatGenerationTokens(summary.prompt_tokens)} → ${formatGenerationTokens(summary.completion_tokens)}`}
          icon={RouteIcon}
          mono
        />
        <MetricCard
          label={t('Cached')}
          value={`${formatGenerationTokens(cachedTokens)} · ${(summary.cache?.cache_hit_rate ?? 0).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`}
          icon={DatabaseIcon}
        />
        <MetricCard
          label={t('Fallbacks')}
          value={retryChain.length > 0 ? fallbackCount.toLocaleString() : '--'}
          icon={RefreshCcwIcon}
          muted={retryChain.length === 0}
        />
      </div>

      <PromptDebugPanel
        prompt={summary.prompt}
        rawRequest={rawRequest}
        providerPromptTokens={summary.prompt_tokens}
        providerCachedTokens={cachedTokens}
      />

      <Tabs defaultValue='completion' className='min-w-0'>
        <TabsList variant='line' className='w-full justify-start'>
          <TabsTrigger value='completion'>{t('Completion')}</TabsTrigger>
          {props.isAdmin && raw && (
            <TabsTrigger value='raw'>{t('Raw')}</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value='completion' className='min-w-0 pt-1'>
          <CompletionDebugPanel
            completion={summary.completion}
            rawResponse={rawResponse}
          />
        </TabsContent>
        {props.isAdmin && raw && (
          <TabsContent value='raw' className='min-w-0 pt-1'>
            <RawDebugPanel raw={raw} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
