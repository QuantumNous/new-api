/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  AudioLines,
  Image,
  Layers,
  LayoutGrid,
  MessageSquare,
  Pin,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { PricingModel } from '../../../pricing/types'
import { isPlaygroundImageModel } from '../../lib/studio/image-request-schema'
import { getModelModality } from '../../lib/studio/model-modality'
import {
  isLikelyNewModel,
  modalityLabelKey,
  MODALITY_COLORS,
} from '../../lib/workbench/modality-styles'
import type { ModelOption, StudioModality } from '../../types'
import { ModelBrandIcon } from './model-brand-icon'

type CatalogFilter = 'all' | StudioModality

const FILTERS: Array<{
  id: CatalogFilter
  labelKey: string
  Icon: LucideIcon
}> = [
  { id: 'all', labelKey: 'All', Icon: LayoutGrid },
  { id: 'chat', labelKey: 'Chat', Icon: MessageSquare },
  { id: 'image', labelKey: 'Image', Icon: Image },
  { id: 'video', labelKey: 'Video', Icon: Video },
  { id: 'audio', labelKey: 'Audio', Icon: AudioLines },
]

const modalityIcons = {
  chat: MessageSquare,
  image: Image,
  video: Video,
  audio: AudioLines,
} as const

type ModelCatalogProps = {
  available: ModelOption[]
  models: PricingModel[]
  selected: string
  loading: boolean
  error: boolean
  onRetry: () => void
  onSelect: (model: PricingModel) => void
  pinnedModels?: string[]
  onTogglePin?: (modelName: string) => void
  duoEnabled?: boolean
  onOpenDuo?: () => void
}

export function ModelCatalog(props: ModelCatalogProps) {
  const { t } = useTranslation()
  const [modality, setModality] = useState<CatalogFilter>('all')
  const pinnedSet = useMemo(
    () => new Set(props.pinnedModels ?? []),
    [props.pinnedModels]
  )
  const availableNames = useMemo(
    () => new Set(props.available.map((item) => item.value)),
    [props.available]
  )
  const catalog = useMemo(
    () => props.models.filter((model) => availableNames.has(model.model_name)),
    [availableNames, props.models]
  )

  const counts = useMemo(() => {
    const next: Record<CatalogFilter, number> = {
      all: 0,
      chat: 0,
      image: 0,
      video: 0,
      audio: 0,
    }
    for (const model of catalog) {
      const modelModality = getModelModality(model)
      if (
        modelModality === 'image' &&
        !isPlaygroundImageModel(model.model_name)
      ) {
        continue
      }
      next.all += 1
      next[modelModality] += 1
    }
    return next
  }, [catalog])

  const filtered = useMemo(() => {
    const list = catalog.filter((model) => {
      const modelModality = getModelModality(model)
      if (
        modelModality === 'image' &&
        !isPlaygroundImageModel(model.model_name)
      ) {
        return false
      }
      if (modality !== 'all' && modelModality !== modality) return false
      return true
    })
    return list.sort((a, b) => {
      const ap = pinnedSet.has(a.model_name) ? 0 : 1
      const bp = pinnedSet.has(b.model_name) ? 0 : 1
      if (ap !== bp) return ap - bp
      return a.model_name.localeCompare(b.model_name)
    })
  }, [catalog, modality, pinnedSet])

  return (
    <div className='flex h-full min-h-0 flex-col bg-transparent'>
      <div className='border-border/70 shrink-0 border-b px-2.5 py-2.5 sm:px-3'>
        <div
          className='bg-muted/45 ring-border/60 grid grid-cols-5 gap-0.5 rounded-xl p-0.5 ring-1'
          role='tablist'
          aria-label={t('Filter by modality')}
        >
          {FILTERS.map((item) => {
            const Icon = item.Icon
            const active = modality === item.id
            const count = counts[item.id]
            const disabled = item.id !== 'all' && count === 0
            return (
              <button
                key={item.id}
                type='button'
                role='tab'
                aria-selected={active}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                onClick={() => setModality(item.id)}
                className={cn(
                  'focus-visible:ring-ring flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-0.5 py-1.5 text-center outline-none transition-[color,background-color,box-shadow,transform] focus-visible:ring-2 active:scale-[0.98] sm:min-h-10',
                  active
                    ? 'bg-background text-primary shadow-xs ring-border/70 ring-1'
                    : 'text-muted-foreground hover:text-foreground',
                  disabled && 'pointer-events-none opacity-35'
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 shrink-0',
                    active ? 'text-primary' : 'opacity-80'
                  )}
                  aria-hidden='true'
                />
                <span className='text-[10px] leading-none font-semibold tracking-wide'>
                  {t(item.labelKey)}
                </span>
                <span
                  className={cn(
                    'font-mono text-[9px] leading-none tabular-nums',
                    active ? 'text-primary/80' : 'text-muted-foreground/80'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2'>
        {props.onOpenDuo && (
          <button
            type='button'
            onClick={props.onOpenDuo}
            className={cn(
              'mb-1 flex w-full items-start gap-2.5 rounded-[11px] border border-dashed border-primary/25 bg-primary/[0.06] p-2.5 text-left outline-none transition-colors',
              'hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
              props.duoEnabled && 'border-solid border-primary/40 shadow-sm'
            )}
          >
            <span className='bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
              <Layers className='size-4' aria-hidden='true' />
            </span>
            <span className='min-w-0'>
              <span className='text-primary block text-xs font-semibold'>
                {t('Multi-model collaboration')}
              </span>
              <span className='text-muted-foreground mt-0.5 line-clamp-2 text-[11px]'>
                {t('Compare answers from several chat models, then summarize.')}
              </span>
            </span>
          </button>
        )}

        {props.loading &&
          ['one', 'two', 'three', 'four', 'five', 'six'].map((key) => (
            <Skeleton
              key={key}
              className='bg-muted/50 h-[4.5rem] w-full rounded-[11px]'
            />
          ))}
        {props.error && (
          <CatalogState
            text={t('Model catalog could not be loaded.')}
            action={t('Try again')}
            onAction={props.onRetry}
          />
        )}
        {!props.loading && !props.error && filtered.length === 0 && (
          <CatalogState
            text={t('No models match these filters.')}
            action={t('Show all')}
            onAction={() => setModality('all')}
          />
        )}
        <div className='space-y-1.5'>
          {filtered.map((model) => {
            const modelModality = getModelModality(model)
            const ModalityIcon = modalityIcons[modelModality]
            const selected = props.selected === model.model_name
            const pinned = pinnedSet.has(model.model_name)
            const isNew = isLikelyNewModel(model)
            return (
              <div
                key={model.model_name}
                className={cn(
                  'group relative w-full rounded-[11px] border border-transparent transition-all',
                  selected
                    ? 'border-primary/30 from-primary/12 to-primary/4 bg-gradient-to-br shadow-sm'
                    : 'hover:border-border hover:bg-muted/40 hover:shadow-sm'
                )}
              >
                <button
                  type='button'
                  onClick={() => props.onSelect(model)}
                  aria-current={selected ? 'true' : undefined}
                  className='focus-visible:ring-ring w-full p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <span className='flex min-w-0 items-center gap-2'>
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                          MODALITY_COLORS[modelModality].tile
                        )}
                      >
                        <ModelBrandIcon
                          modelName={model.model_name}
                          icon={model.icon}
                          vendorIcon={model.vendor_icon}
                          size={22}
                        />
                      </span>
                      <span className='min-w-0'>
                        <span className='flex items-center gap-1.5'>
                          <span className='text-foreground block truncate font-mono text-xs font-semibold'>
                            {model.model_name}
                          </span>
                          {isNew && (
                            <span className='bg-chart-4/20 text-chart-4 ring-chart-4/30 shrink-0 rounded px-1 py-px text-[9px] font-bold tracking-wide ring-1'>
                              {t('NEW')}
                            </span>
                          )}
                        </span>
                        <span className='text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-[11px]'>
                          <ModalityIcon className='size-3' aria-hidden='true' />
                          {model.vendor_name ||
                            t(modalityLabelKey(modelModality))}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize',
                        MODALITY_COLORS[modelModality].tag,
                        // The pin button occupies the same corner; crossfade
                        // so the two never stack on top of each other.
                        props.onTogglePin &&
                          'transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0',
                        props.onTogglePin && pinned && 'opacity-0'
                      )}
                    >
                      {t(modalityLabelKey(modelModality))}
                    </span>
                  </div>
                  <p className='text-muted-foreground mt-1.5 line-clamp-2 text-[11px] text-pretty'>
                    {model.description ||
                      model.vendor_description ||
                      t('Available for generation')}
                  </p>
                </button>
                {props.onTogglePin && (
                  <button
                    type='button'
                    className={cn(
                      'absolute top-2 right-2 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100',
                      pinned
                        ? 'text-primary'
                        : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground/80'
                    )}
                    aria-label={pinned ? t('Unpin model') : t('Pin model')}
                    aria-pressed={pinned}
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onTogglePin?.(model.model_name)
                    }}
                  >
                    <Pin
                      className={cn('size-3.5', pinned && 'fill-current')}
                      aria-hidden='true'
                    />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CatalogState(props: {
  text: string
  action: string
  onAction: () => void
}) {
  return (
    <div className='grid place-items-center gap-2 px-4 py-12 text-center'>
      <p className='text-muted-foreground text-sm text-pretty'>{props.text}</p>
      <Button
        size='sm'
        variant='outline'
        className='border-border bg-muted/50 text-foreground hover:bg-muted'
        onClick={props.onAction}
      >
        {props.action}
      </Button>
    </div>
  )
}
