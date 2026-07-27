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
  Search,
  Video,
  X,
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
import { getBrandColor } from './brand-color'
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
  const [query, setQuery] = useState('')
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
    const normalizedQuery = query.trim().toLowerCase()
    return catalog.filter((model) => {
      const modelModality = getModelModality(model)
      if (
        modelModality === 'image' &&
        !isPlaygroundImageModel(model.model_name)
      ) {
        return false
      }
      if (modality !== 'all' && modelModality !== modality) return false
      if (!normalizedQuery) return true
      return (
        model.model_name.toLowerCase().includes(normalizedQuery) ||
        (model.vendor_name ?? '').toLowerCase().includes(normalizedQuery) ||
        (model.description ?? '').toLowerCase().includes(normalizedQuery)
      )
    })
  }, [catalog, modality, query])

  // Pinned models float to a dedicated section; the rest group by provider
  // in alphabetical order, unattributed models last.
  const groups = useMemo(() => {
    const byName = (a: PricingModel, b: PricingModel) =>
      a.model_name.localeCompare(b.model_name)
    const pinned: PricingModel[] = []
    const byVendor = new Map<string, PricingModel[]>()
    for (const model of filtered) {
      if (pinnedSet.has(model.model_name)) {
        pinned.push(model)
        continue
      }
      const vendor = model.vendor_name?.trim() ?? ''
      const list = byVendor.get(vendor)
      if (list) {
        list.push(model)
      } else {
        byVendor.set(vendor, [model])
      }
    }
    const vendorGroups = [...byVendor.entries()]
      .map(([vendor, models]) => ({ vendor, models: models.sort(byName) }))
      .sort((a, b) => {
        if (!a.vendor !== !b.vendor) return a.vendor ? -1 : 1
        return a.vendor.localeCompare(b.vendor)
      })
    return { pinned: pinned.sort(byName), vendorGroups }
  }, [filtered, pinnedSet])

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
        <div className='relative mt-2'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2'
            aria-hidden='true'
          />
          <input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search models')}
            aria-label={t('Search models')}
            className='border-border/60 bg-background/60 placeholder:text-muted-foreground/70 focus-visible:ring-ring h-8 w-full rounded-lg border pr-7 pl-8 text-xs outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden'
          />
          {query && (
            <button
              type='button'
              aria-label={t('Clear search')}
              onClick={() => setQuery('')}
              className='text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1'
            >
              <X className='size-3' aria-hidden='true' />
            </button>
          )}
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
              className='bg-muted/50 h-10 w-full rounded-[11px]'
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
            onAction={() => {
              setModality('all')
              setQuery('')
            }}
          />
        )}

        {groups.pinned.length > 0 && (
          <section>
            <GroupHeader
              label={t('Pinned')}
              count={groups.pinned.length}
              icon={
                <Pin
                  className='text-primary size-3 fill-current'
                  aria-hidden='true'
                />
              }
            />
            <div className='space-y-1.5 pt-1.5'>
              {groups.pinned.map((model) => (
                <ModelCard
                  key={model.model_name}
                  model={model}
                  selected={props.selected === model.model_name}
                  pinned
                  onSelect={props.onSelect}
                  onTogglePin={props.onTogglePin}
                />
              ))}
            </div>
          </section>
        )}

        {groups.vendorGroups.map((group) => (
          <section key={group.vendor || '__other'}>
            <GroupHeader
              label={group.vendor || t('Other providers')}
              count={group.models.length}
              icon={
                group.vendor ? (
                  <ModelBrandIcon
                    modelName={group.models[0].model_name}
                    icon={group.models[0].vendor_icon || group.models[0].icon}
                    size={14}
                  />
                ) : (
                  <LayoutGrid
                    className='text-muted-foreground size-3'
                    aria-hidden='true'
                  />
                )
              }
            />
            <div className='space-y-1.5 pt-1.5'>
              {group.models.map((model) => (
                <ModelCard
                  key={model.model_name}
                  model={model}
                  selected={props.selected === model.model_name}
                  pinned={pinnedSet.has(model.model_name)}
                  onSelect={props.onSelect}
                  onTogglePin={props.onTogglePin}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function GroupHeader(props: {
  label: string
  count: number
  icon?: React.ReactNode
}) {
  return (
    <div className='bg-sidebar/90 border-border/40 sticky -top-2 z-10 -mx-2 flex items-center gap-1.5 border-b px-3.5 py-1.5 backdrop-blur-md'>
      {props.icon}
      <span className='text-foreground/80 truncate text-[11px] font-semibold tracking-wide'>
        {props.label}
      </span>
      <span className='text-muted-foreground/80 font-mono text-[10px] tabular-nums'>
        {props.count}
      </span>
    </div>
  )
}

/**
 * Provider card archetypes. Each provider deterministically maps to one of
 * these so different providers read differently at a glance while models of
 * the same provider stay visually consistent. All decorations derive from
 * the brand color exposed as the `--brand` CSS variable.
 */
const CARD_VARIANT_COUNT = 4

function providerVariant(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash % CARD_VARIANT_COUNT
}

function variantTexture(variant: number): React.CSSProperties {
  switch (variant) {
    case 0:
      // Diagonal brand wash from the icon side.
      return {
        background:
          'linear-gradient(115deg, color-mix(in srgb, var(--brand) 16%, transparent), color-mix(in srgb, var(--brand) 5%, transparent) 45%, transparent 70%)',
      }
    case 1:
      // Soft halo glowing from the top-right corner.
      return {
        background:
          'radial-gradient(130px circle at 92% -20%, color-mix(in srgb, var(--brand) 26%, transparent), transparent 72%)',
      }
    case 2:
      // Fine pinstripes plus a solid brand spine on the left edge.
      return {
        background:
          'linear-gradient(to right, color-mix(in srgb, var(--brand) 60%, transparent) 0 3px, transparent 3px), repeating-linear-gradient(135deg, color-mix(in srgb, var(--brand) 7%, transparent) 0 1px, transparent 1px 8px)',
      }
    default:
      // Dot grid fading out toward the text.
      return {
        backgroundImage:
          'radial-gradient(color-mix(in srgb, var(--brand) 30%, transparent) 1px, transparent 1.5px)',
        backgroundSize: '9px 9px',
        maskImage: 'linear-gradient(to left, black 25%, transparent 75%)',
        WebkitMaskImage: 'linear-gradient(to left, black 25%, transparent 75%)',
      }
  }
}

const WATERMARK_CLASSES = [
  'top-1/2 -right-3 -translate-y-1/2 rotate-12',
  '-top-4 right-6 -rotate-6',
  '-bottom-4 right-8 rotate-6',
  'top-1/2 right-10 -translate-y-1/2 -rotate-12',
] as const

function ModelCard(props: {
  model: PricingModel
  selected: boolean
  pinned: boolean
  onSelect: (model: PricingModel) => void
  onTogglePin?: (modelName: string) => void
}) {
  const { t } = useTranslation()
  const { model, selected, pinned } = props
  const modelModality = getModelModality(model)
  const ModalityIcon = modalityIcons[modelModality]
  const isNew = isLikelyNewModel(model)
  const brand = getBrandColor(model.icon, model.vendor_icon)
  const variant = providerVariant(
    model.vendor_name?.trim() || model.model_name.split(/[-/.]/)[0]
  )

  return (
    <div
      className={cn(
        'group border-border/50 bg-background/40 relative w-full overflow-hidden rounded-[11px] border transition-all',
        selected
          ? 'border-primary/45 ring-primary/25 shadow-sm ring-1'
          : 'hover:border-border hover:shadow-sm'
      )}
      style={
        {
          '--brand': brand ?? 'var(--muted-foreground)',
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0'
        style={variantTexture(variant)}
      />
      <div
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute opacity-[0.09] saturate-150 transition-opacity duration-200 group-hover:opacity-[0.16] dark:opacity-[0.14] dark:group-hover:opacity-[0.22]',
          WATERMARK_CLASSES[variant]
        )}
      >
        <ModelBrandIcon
          modelName={model.model_name}
          icon={model.icon}
          vendorIcon={model.vendor_icon}
          size={56}
        />
      </div>

      <button
        type='button'
        onClick={() => props.onSelect(model)}
        aria-current={selected ? 'true' : undefined}
        className='focus-visible:ring-ring relative flex w-full items-center gap-2 p-2 pr-9 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset'
      >
        <span
          className='flex size-8 shrink-0 items-center justify-center rounded-lg ring-1'
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--brand) 13%, transparent)',
            boxShadow:
              'inset 0 0 0 1px color-mix(in srgb, var(--brand) 30%, transparent)',
          }}
        >
          <ModelBrandIcon
            modelName={model.model_name}
            icon={model.icon}
            vendorIcon={model.vendor_icon}
            size={20}
          />
        </span>
        <span className='flex min-w-0 flex-1 items-center gap-1.5'>
          <span
            className={cn(
              'truncate font-mono text-xs font-semibold',
              selected ? 'text-primary' : 'text-foreground'
            )}
          >
            {model.model_name}
          </span>
          {isNew && (
            <span className='bg-chart-4/20 text-chart-4 ring-chart-4/30 shrink-0 rounded px-1 py-px text-[9px] font-bold tracking-wide ring-1'>
              {t('NEW')}
            </span>
          )}
        </span>
        <ModalityIcon
          className={cn(
            'size-3.5 shrink-0',
            MODALITY_COLORS[modelModality].text,
            // The pin button occupies the same corner; crossfade so the two
            // never stack on top of each other.
            props.onTogglePin &&
              'transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0',
            props.onTogglePin && pinned && 'opacity-0'
          )}
          aria-label={t(modalityLabelKey(modelModality))}
        />
      </button>
      {props.onTogglePin && (
        <button
          type='button'
          className={cn(
            'focus-visible:ring-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 outline-none focus-visible:opacity-100 focus-visible:ring-2',
            pinned
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground/80 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
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
