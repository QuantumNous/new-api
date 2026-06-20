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
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import { JsonViewer } from './json-viewer'
import { TokenMessageChart } from './token-message-chart'
import type {
  GenerationDebugPromptUnit,
  GenerationDebugRawValue,
  PromptDebugData,
} from './types'
import {
  cacheStatusLabel,
  cacheStatusVariant,
  confidenceLabel,
  derivePromptCacheView,
  formatGenerationTokens,
  normalizedPromptUnits,
  roleLabel,
  roleCountsFromMessages,
  roleVariant,
  sourceLabel,
  unitKindLabel,
} from './utils'

interface PromptDebugPanelProps {
  prompt: PromptDebugData | undefined
  rawRequest: GenerationDebugRawValue | undefined
  providerPromptTokens: number
  providerCachedTokens: number
}

export function PromptDebugPanel(props: PromptDebugPanelProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [showRawRequest, setShowRawRequest] = useState(false)
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0)
  const messages = useMemo(
    () => props.prompt?.messages ?? [],
    [props.prompt?.messages]
  )
  const baseUnits = useMemo(
    () => normalizedPromptUnits(props.prompt),
    [props.prompt]
  )
  const cacheView = useMemo(
    () =>
      derivePromptCacheView(
        baseUnits,
        props.providerPromptTokens,
        props.providerCachedTokens,
        props.prompt?.cache_boundary
      ),
    [
      baseUnits,
      props.prompt?.cache_boundary,
      props.providerCachedTokens,
      props.providerPromptTokens,
    ]
  )
  const units = cacheView.units
  const selectedUnit = units[selectedUnitIndex] ?? units[0]
  const roleCounts = useMemo(
    () =>
      Object.keys(props.prompt?.role_counts ?? {}).length > 0
        ? (props.prompt?.role_counts ?? {})
        : roleCountsFromMessages(messages),
    [messages, props.prompt?.role_counts]
  )

  if (!props.prompt && !props.rawRequest) {
    return (
      <p className='text-muted-foreground text-xs'>{t('No prompt data')}</p>
    )
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <CacheBoundaryCard
        prompt={props.prompt}
        providerPromptTokens={props.providerPromptTokens}
        providerCachedTokens={props.providerCachedTokens}
        cacheBoundary={cacheView.boundary}
      />

      <div className='grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]'>
        <div className='flex min-w-0 flex-col gap-3'>
          {units.length > 0 && (
            <TokenMessageChart
              units={units}
              cacheBoundary={cacheView.boundary}
            />
          )}
          <div className='grid min-w-0 gap-2 sm:grid-cols-2'>
            <div className='bg-muted/30 flex min-w-0 flex-col gap-1.5 rounded-md border p-2.5'>
              <span className='text-muted-foreground text-[11px]'>
                {t('Estimated prompt tokens')}
              </span>
              <span className='font-mono text-sm font-semibold'>
                {formatGenerationTokens(
                  props.prompt?.total_estimated_tokens ?? 0
                )}
              </span>
            </div>
            <div className='bg-muted/30 flex min-w-0 flex-col gap-1.5 rounded-md border p-2.5'>
              <span className='text-muted-foreground text-[11px]'>
                {t('Role counts')}
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {Object.entries(roleCounts).map(([role, count]) => (
                  <StatusBadge
                    key={role}
                    label={`${roleLabel(role, t)} · ${count}`}
                    variant={roleVariant(role)}
                    size='sm'
                    copyable={false}
                  />
                ))}
              </div>
            </div>
          </div>
          <UnitList
            units={units}
            selectedUnit={selectedUnit}
            onSelectUnit={(unit) => {
              setShowRawRequest(false)
              setSelectedUnitIndex(unit.index)
            }}
          />
        </div>

        <div className='flex min-w-0 flex-col gap-3'>
          {props.rawRequest && (
            <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2'>
              <Label>{t('Selected prompt field')}</Label>
              <Button
                variant={showRawRequest ? 'default' : 'outline'}
                size='xs'
                onClick={() => setShowRawRequest((value) => !value)}
              >
                {showRawRequest
                  ? t('Show selected field')
                  : t('Show raw request')}
              </Button>
            </div>
          )}
          {showRawRequest && props.rawRequest ? (
            <JsonViewer
              value={props.rawRequest.value}
              rawMeta={props.rawRequest}
              maxHeightClassName='h-[min(55dvh,560px)]'
            />
          ) : (
            <UnitDetail
              unit={selectedUnit}
              copiedText={copiedText}
              onCopyPath={copyToClipboard}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CacheBoundaryCard(props: {
  prompt: PromptDebugData | undefined
  providerPromptTokens: number
  providerCachedTokens: number
  cacheBoundary: PromptDebugData['cache_boundary']
}) {
  const { t } = useTranslation()
  const accounting = props.prompt?.token_accounting
  const promptTokens =
    props.providerPromptTokens ||
    accounting?.prompt_tokens ||
    props.prompt?.total_estimated_tokens ||
    0
  const cachedTokens = props.providerCachedTokens
  const cacheHitRate =
    props.cacheBoundary?.cache_hit_rate ??
    (promptTokens > 0 ? cachedTokens / promptTokens : 0)
  const breakpointText = props.cacheBoundary?.break_unit_path
    ? `${props.cacheBoundary.break_unit_path} · ${t('offset')} ${formatGenerationTokens(props.cacheBoundary.break_offset_tokens)} ${t('estimated tokens')}`
    : t('No prompt field breakpoint')

  return (
    <div className='bg-muted/30 grid min-w-0 gap-2 rounded-md border p-3 text-xs md:grid-cols-4'>
      <MetricLine
        label={t('Provider prompt tokens')}
        value={`${formatGenerationTokens(promptTokens)} ${confidenceLabel('exact', t)}`}
      />
      <MetricLine
        label={t('Provider cached tokens')}
        value={`${formatGenerationTokens(cachedTokens)} ${confidenceLabel('exact', t)}`}
      />
      <MetricLine
        label={t('Cache hit rate')}
        value={`${formatGenerationTokens(cachedTokens)} / ${formatGenerationTokens(promptTokens)} · ${cacheHitRate.toLocaleString(
          undefined,
          {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )} ${t('exact-total / inferred-field')}`}
      />
      <MetricLine label={t('Breakpoint')} value={breakpointText} mono />
      {accounting && accounting.cache_write_tokens > 0 && (
        <div className='md:col-span-4'>
          <StatusBadge
            label={`${t('Cache write tokens')}: ${formatGenerationTokens(accounting.cache_write_tokens)} · ${confidenceLabel(accounting.cache_write_confidence ?? accounting.confidence, t)}`}
            variant='blue'
            size='sm'
            copyable={false}
          />
        </div>
      )}
      {cachedTokens === 0 && (
        <p className='text-muted-foreground md:col-span-4'>
          {t('No cache hit detected')}
        </p>
      )}
    </div>
  )
}

function MetricLine(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-muted-foreground'>{props.label}</span>
      <span
        className={cn(
          'min-w-0 break-words font-semibold',
          props.mono && 'font-mono text-[11px]'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function UnitList(props: {
  units: GenerationDebugPromptUnit[]
  selectedUnit: GenerationDebugPromptUnit | undefined
  onSelectUnit: (unit: GenerationDebugPromptUnit) => void
}) {
  const { t } = useTranslation()
  if (props.units.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>{t('No prompt data')}</p>
    )
  }

  return (
    <ScrollArea className='h-[min(55dvh,560px)] rounded-md border'>
      <div className='flex min-w-0 flex-col divide-y'>
        {props.units.map((unit) => (
          <button
            key={`${unit.index}-${unit.path}`}
            type='button'
            className={cn(
              'hover:bg-muted/40 flex min-w-0 flex-col gap-2 p-3 text-left transition-colors',
              props.selectedUnit?.index === unit.index && 'bg-muted/50'
            )}
            onClick={() => props.onSelectUnit(unit)}
          >
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <span className='text-muted-foreground font-mono text-[11px]'>
                  #{unit.index + 1}
                </span>
                <StatusBadge
                  label={roleLabel(unit.role, t)}
                  variant={roleVariant(unit.role ?? '')}
                  size='sm'
                  copyable={false}
                />
                <StatusBadge
                  label={cacheStatusLabel(unit.cache_status, t)}
                  variant={cacheStatusVariant(unit.cache_status)}
                  size='sm'
                  copyable={false}
                />
              </div>
              <span className='text-muted-foreground text-[11px]'>
                ~{formatGenerationTokens(unit.estimated_tokens)} {t('tokens')}
              </span>
            </div>
            <div className='text-muted-foreground flex min-w-0 flex-wrap gap-2 font-mono text-[11px]'>
              <span className='truncate'>{unit.path}</span>
              <span>
                {unit.confidence === 'inferred'
                  ? t('field attribution inferred')
                  : t('estimated tokens')}
              </span>
            </div>
            <p className='line-clamp-3 text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {unit.content_preview || t('No text content')}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

function UnitDetail(props: {
  unit: GenerationDebugPromptUnit | undefined
  copiedText: string | null
  onCopyPath: (text: string) => void
}) {
  const { t } = useTranslation()
  if (!props.unit) {
    return (
      <p className='text-muted-foreground text-xs'>{t('No prompt data')}</p>
    )
  }

  return (
    <div className='bg-muted/20 flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-md border p-3'>
      <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <StatusBadge
            label={roleLabel(props.unit.role, t)}
            variant={roleVariant(props.unit.role ?? '')}
            size='sm'
            copyable={false}
          />
          <StatusBadge
            label={cacheStatusLabel(props.unit.cache_status, t)}
            variant={cacheStatusVariant(props.unit.cache_status)}
            size='sm'
            copyable={false}
          />
          <StatusBadge
            label={confidenceLabel(props.unit.confidence, t)}
            variant='grey'
            size='sm'
            copyable={false}
          />
        </div>
        <Button
          variant='outline'
          size='xs'
          onClick={() => props.onCopyPath(props.unit?.path ?? '')}
          aria-label={t('Copy path')}
        >
          {props.copiedText === props.unit.path ? (
            <CheckIcon data-icon='inline-start' />
          ) : (
            <CopyIcon data-icon='inline-start' />
          )}
          {t('Copy path')}
        </Button>
      </div>
      <div className='grid gap-2 text-xs sm:grid-cols-2'>
        <MetricLine label={t('Path')} value={props.unit.path} mono />
        <MetricLine
          label={t('Kind')}
          value={unitKindLabel(props.unit.kind, t)}
        />
        <MetricLine
          label={t('Estimated tokens')}
          value={formatGenerationTokens(props.unit.estimated_tokens)}
        />
        <MetricLine
          label={t('Cumulative range')}
          value={`${props.unit.cumulative_start.toLocaleString()} - ${props.unit.cumulative_end.toLocaleString()}`}
        />
        <MetricLine
          label={t('Cache overlap')}
          value={formatGenerationTokens(props.unit.cache_overlap_tokens)}
        />
        <MetricLine
          label={t('Cache source')}
          value={sourceLabel(props.unit.cache_source, t)}
        />
      </div>
      <ScrollArea className='bg-background/60 h-[min(38dvh,360px)] min-w-0 rounded-md border'>
        <p className='p-3 text-xs leading-relaxed break-words whitespace-pre-wrap'>
          {props.unit.content_preview || t('No text content')}
        </p>
      </ScrollArea>
    </div>
  )
}
