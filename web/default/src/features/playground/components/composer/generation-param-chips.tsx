/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  AudioLines,
  Check,
  ChevronDown,
  Clock,
  Gauge,
  Layers,
  Mic,
  Monitor,
  Proportions,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import {
  AUDIO_FORMATS,
  IMAGE_COUNTS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  SPEEDS,
  VIDEO_DURATIONS,
  VIDEO_SIZES,
  VOICES,
  imageQualityLabelKey,
  videoSizeLabel,
} from '../../lib/studio/generation-options'
import {
  normalizeImageGenerationSettings,
  type GptImageSize,
} from '../../lib/studio/image-request-schema'
import type { StudioModality, StudioSettings } from '../../types'

type ChipOption = {
  value: string
  label: string
  glyph?: ReactNode
}

/**
 * One tap-to-open parameter chip (Midjourney-style imagine bar control).
 * The current value is always visible; options open in a compact popover.
 */
function ParamChip(props: {
  icon: ReactNode
  ariaLabel: string
  valueLabel: string
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={props.ariaLabel}
        className={cn(
          'border-border/80 bg-background/70 text-foreground/85 inline-flex h-8 shrink-0 touch-manipulation items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
          'hover:border-border hover:text-foreground focus-visible:ring-ring transition-colors outline-none focus-visible:ring-2',
          open && 'border-primary/50 text-foreground'
        )}
      >
        <span className='text-muted-foreground [&>svg]:size-3.5'>
          {props.icon}
        </span>
        <span className='max-w-28 truncate'>{props.valueLabel}</span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-3 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden='true'
        />
      </PopoverTrigger>
      <PopoverContent align='start' side='top' className='w-56 p-1.5'>
        <div className='flex flex-col gap-0.5' role='listbox'>
          {props.options.map((option) => {
            const selected = option.value === props.value
            return (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={selected}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-md px-2 text-left text-sm',
                  'hover:bg-muted/70 focus-visible:ring-ring transition-colors outline-none focus-visible:ring-2',
                  selected && 'bg-muted text-foreground font-medium'
                )}
                onClick={() => {
                  props.onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.glyph && (
                  <span className='text-muted-foreground flex w-6 shrink-0 items-center justify-center'>
                    {option.glyph}
                  </span>
                )}
                <span className='min-w-0 flex-1 truncate'>{option.label}</span>
                {selected && (
                  <Check className='text-primary size-4 shrink-0' />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AspectGlyph(props: { size: string }) {
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(props.size)
  if (!match) {
    return <Proportions className='size-4' aria-hidden='true' />
  }
  const w = Number(match[1])
  const h = Number(match[2])
  const scale = 14 / Math.max(w, h)
  return (
    <span
      className='border-foreground/60 rounded-[3px] border-[1.5px]'
      style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
      aria-hidden='true'
    />
  )
}

function imageSizeChipLabel(
  size: GptImageSize,
  t: (key: string) => string
): string {
  if (size === 'auto') return t('Auto')
  if (size === '1024x1024') return '1:1'
  if (size === '1536x1024') return '3:2'
  if (size === '1024x1536') return '2:3'
  return size
}

/**
 * Inline generation parameters for the composer, per modality. Values are
 * shared with the settings panel through the studio settings store.
 */
export function GenerationParamChips(props: {
  modality: Exclude<StudioModality, 'chat'>
}) {
  const { t } = useTranslation()
  const settings = usePlaygroundStore((state) => state.studioSettings)
  const setStudioSettings = usePlaygroundStore(
    (state) => state.setStudioSettings
  )

  const update = <K extends keyof StudioSettings>(
    key: K,
    value: StudioSettings[K]
  ) => setStudioSettings((prev) => ({ ...prev, [key]: value }))

  if (props.modality === 'image') {
    const normalized = normalizeImageGenerationSettings(settings)
    return (
      <>
        <ParamChip
          icon={<Proportions />}
          ariaLabel={t('Image size')}
          valueLabel={imageSizeChipLabel(normalized.imageSize, t)}
          value={normalized.imageSize}
          onChange={(value) => update('imageSize', value)}
          options={IMAGE_SIZES.map((size) => ({
            value: size,
            label:
              size === 'auto'
                ? t('Auto')
                : `${imageSizeChipLabel(size, t)} · ${size.replace('x', '×')}`,
            glyph: <AspectGlyph size={size} />,
          }))}
        />
        <ParamChip
          icon={<Layers />}
          ariaLabel={t('Image count')}
          valueLabel={`×${normalized.imageCount}`}
          value={String(normalized.imageCount)}
          onChange={(value) => update('imageCount', Number(value))}
          options={IMAGE_COUNTS.map((count) => ({
            value: String(count),
            label: t('{{count}} images', { count }),
          }))}
        />
        <ParamChip
          icon={<Gauge />}
          ariaLabel={t('Image quality')}
          valueLabel={t(imageQualityLabelKey(normalized.imageQuality))}
          value={normalized.imageQuality}
          onChange={(value) => update('imageQuality', value)}
          options={IMAGE_QUALITIES.map((quality) => ({
            value: quality,
            label: t(imageQualityLabelKey(quality)),
          }))}
        />
      </>
    )
  }

  if (props.modality === 'video') {
    return (
      <>
        <ParamChip
          icon={<Clock />}
          ariaLabel={t('Duration (seconds)')}
          valueLabel={`${settings.videoDuration}s`}
          value={String(settings.videoDuration)}
          onChange={(value) => update('videoDuration', Number(value))}
          options={VIDEO_DURATIONS.map((duration) => ({
            value: String(duration),
            label: `${duration}s`,
          }))}
        />
        <ParamChip
          icon={<Monitor />}
          ariaLabel={t('Video size')}
          valueLabel={videoSizeLabel(settings.videoSize)}
          value={settings.videoSize}
          onChange={(value) => update('videoSize', value)}
          options={VIDEO_SIZES.map((size) => ({
            value: size,
            label: videoSizeLabel(size),
          }))}
        />
      </>
    )
  }

  return (
    <>
      <ParamChip
        icon={<Mic />}
        ariaLabel={t('Voice')}
        valueLabel={settings.voice}
        value={settings.voice}
        onChange={(value) => update('voice', value)}
        options={VOICES.map((voice) => ({ value: voice, label: voice }))}
      />
      <ParamChip
        icon={<Gauge />}
        ariaLabel={t('Speed')}
        valueLabel={`${settings.speed}×`}
        value={String(settings.speed)}
        onChange={(value) => update('speed', Number(value))}
        options={SPEEDS.map((speed) => ({
          value: String(speed),
          label: `${speed}×`,
        }))}
      />
      <ParamChip
        icon={<AudioLines />}
        ariaLabel={t('Format')}
        valueLabel={settings.audioFormat}
        value={settings.audioFormat}
        onChange={(value) => update('audioFormat', value)}
        options={AUDIO_FORMATS.map((format) => ({
          value: format,
          label: format,
        }))}
      />
    </>
  )
}
