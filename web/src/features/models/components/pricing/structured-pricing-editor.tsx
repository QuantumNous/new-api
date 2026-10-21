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
/**
 * ============================================================================
 * StructuredPricingEditor
 * ============================================================================
 *
 * Renders the admin editor for image-gen / video-gen / audio-in / audio-out
 * pricing schemas. Each kind gets its own field layout with native units.
 *
 * Design intent: the editor is a controlled component — the drawer owns the
 * ImagePricing / VideoPricing / AudioInPricing / AudioOutPricing state
 * objects and passes them in via `value`. On any input change, we emit a
 * whole new pricing object through `onChange`. This keeps this component
 * pure and testable, and lets the drawer decide when to persist.
 *
 * All numeric inputs accept admin-facing display currency (CNY / USD /
 * CUSTOM). The drawer converts to base USD on save via
 * `convertBillingDisplayToUSD`. That mirrors the currency handling already
 * in place for the legacy per-token fields.
 */
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  AudioInPricing,
  AudioOutPricing,
  ImagePricing,
  VideoPricing,
} from '../../lib/pricing-types'

// ---------------------------------------------------------------------------
// Multiplier map editor — reused by image (quality/size), video (resolution),
// audio-out (voice). All four are `Record<string, number>` under the hood.
// ---------------------------------------------------------------------------

type MultiplierMapEditorProps = {
  label: string
  hint: string
  keyPlaceholder: string
  keySuggestions?: readonly string[]
  value: Record<string, number>
  onChange: (next: Record<string, number>) => void
}

function MultiplierMapEditor({
  label,
  hint,
  keyPlaceholder,
  keySuggestions,
  value,
  onChange,
}: MultiplierMapEditorProps) {
  const { t } = useTranslation()
  // Materialize entries as an array so the admin can add / remove rows in
  // arbitrary order without React re-keying by index breaking focus.
  const entries = Object.entries(value)

  const updateEntry = (index: number, newKey: string, newMult: number) => {
    // Build the next map preserving order, replacing the entry at `index`.
    const next: Record<string, number> = {}
    for (let i = 0; i < entries.length; i++) {
      if (i === index) {
        // Empty key is legal transiently while the admin is typing; keep it
        // in the map so the input doesn't lose focus.
        next[newKey] = newMult
      } else {
        const [k, v] = entries[i]
        next[k] = v
      }
    }
    onChange(next)
  }

  const addEntry = (suggested?: string) => {
    const key = suggested && !value[suggested] ? suggested : ''
    onChange({ ...value, [key]: 1.0 })
  }

  const removeEntry = (index: number) => {
    const next: Record<string, number> = {}
    for (let i = 0; i < entries.length; i++) {
      if (i === index) continue
      const [k, v] = entries[i]
      next[k] = v
    }
    onChange(next)
  }

  return (
    <div className='space-y-2'>
      <div>
        <Label className='text-xs font-medium'>{label}</Label>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </div>
      {entries.length === 0 && (
        <p className='text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs italic'>
          {t('No entries — click below to add one.')}
        </p>
      )}
      {entries.map(([key, mult], i) => (
        <div key={i} className='flex items-center gap-2'>
          <Input
            className='flex-1'
            type='text'
            placeholder={keyPlaceholder}
            value={key}
            onChange={(e) => updateEntry(i, e.target.value, mult)}
          />
          <Input
            className='w-24'
            type='number'
            step='0.001'
            placeholder='1.0'
            value={Number.isFinite(mult) ? mult : ''}
            onChange={(e) =>
              updateEntry(i, key, Number.parseFloat(e.target.value) || 0)
            }
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => removeEntry(i)}
            aria-label={t('Remove entry')}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      ))}
      <div className='flex flex-wrap gap-1'>
        {keySuggestions
          ?.filter((s) => !(s in value))
          .map((s) => (
            <Button
              key={s}
              type='button'
              variant='outline'
              size='sm'
              className='h-6 px-2 text-xs'
              onClick={() => addEntry(s)}
            >
              <Plus className='mr-1 h-3 w-3' />
              {s}
            </Button>
          ))}
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-6 px-2 text-xs'
          onClick={() => addEntry()}
        >
          <Plus className='mr-1 h-3 w-3' />
          {t('Custom')}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImageGenEditor
// ---------------------------------------------------------------------------

const IMAGE_QUALITY_SUGGESTIONS = ['low', 'medium', 'high', 'hd', 'standard'] as const
const IMAGE_SIZE_SUGGESTIONS = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
  '512x512',
  '2048x2048',
] as const

type ImageGenEditorProps = {
  value: ImagePricing
  onChange: (next: ImagePricing) => void
  currencyLabel: string
}

export function ImageGenEditor({
  value,
  onChange,
  currencyLabel,
}: ImageGenEditorProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>
          {t('Base price per image ({{unit}})', { unit: currencyLabel })}
        </Label>
        <Input
          type='number'
          step='0.0001'
          placeholder='0.04'
          value={value.price_per_image || ''}
          onChange={(e) =>
            onChange({
              ...value,
              price_per_image: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t('Cost per generated image, in the currently displayed currency (stored as base USD).')}
        </p>
      </div>

      <MultiplierMapEditor
        label={t('Quality multipliers')}
        hint={t(
          'Multiplier applied to base price for each quality tier (e.g. "hd" = 2×). Missing entries default to 1.'
        )}
        keyPlaceholder={t('quality (e.g. hd)')}
        keySuggestions={IMAGE_QUALITY_SUGGESTIONS}
        value={value.quality_multipliers ?? {}}
        onChange={(m) => onChange({ ...value, quality_multipliers: m })}
      />

      <MultiplierMapEditor
        label={t('Size multipliers')}
        hint={t(
          'Multiplier applied to base price for each output size (e.g. "1024x1792" = 1.5×). Missing entries default to 1.'
        )}
        keyPlaceholder={t('size (e.g. 1024x1024)')}
        keySuggestions={IMAGE_SIZE_SUGGESTIONS}
        value={value.size_multipliers ?? {}}
        onChange={(m) => onChange({ ...value, size_multipliers: m })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// VideoGenEditor
// ---------------------------------------------------------------------------

const VIDEO_RESOLUTION_SUGGESTIONS = ['480p', '720p', '1080p', '4k'] as const

type VideoGenEditorProps = {
  value: VideoPricing
  onChange: (next: VideoPricing) => void
  currencyLabel: string
}

export function VideoGenEditor({
  value,
  onChange,
  currencyLabel,
}: VideoGenEditorProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>
          {t('Base price per second ({{unit}})', { unit: currencyLabel })}
        </Label>
        <Input
          type='number'
          step='0.0001'
          placeholder='0.05'
          value={value.price_per_second || ''}
          onChange={(e) =>
            onChange({
              ...value,
              price_per_second: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t('Cost per second of generated video (base tier, e.g. 720p).')}
        </p>
      </div>

      <MultiplierMapEditor
        label={t('Resolution multipliers')}
        hint={t(
          'Multiplier applied per output resolution (e.g. "1080p" = 2×, "4k" = 4×). Missing keys default to 1.'
        )}
        keyPlaceholder={t('resolution (e.g. 1080p)')}
        keySuggestions={VIDEO_RESOLUTION_SUGGESTIONS}
        value={value.resolution_multipliers ?? {}}
        onChange={(m) => onChange({ ...value, resolution_multipliers: m })}
      />

      <div className='space-y-2'>
        <Label>{t('Audio-on multiplier')}</Label>
        <Input
          type='number'
          step='0.01'
          placeholder='1.0'
          value={value.has_audio_multiplier || ''}
          onChange={(e) =>
            onChange({
              ...value,
              has_audio_multiplier: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Extra multiplier when the render includes audio (Veo 3.1: 1.5×). Set 0 or 1 for no uplift.'
          )}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AudioInEditor (ASR)
// ---------------------------------------------------------------------------

type AudioInEditorProps = {
  value: AudioInPricing
  onChange: (next: AudioInPricing) => void
  currencyLabel: string
}

export function AudioInEditor({
  value,
  onChange,
  currencyLabel,
}: AudioInEditorProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>
          {t('Price per minute ({{unit}})', { unit: currencyLabel })}
        </Label>
        <Input
          type='number'
          step='0.0001'
          placeholder='0.006'
          value={value.price_per_minute || ''}
          onChange={(e) =>
            onChange({
              ...value,
              price_per_minute: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t('Cost per minute of transcribed audio (e.g. Whisper: $0.006/min).')}
        </p>
      </div>

      <div className='space-y-2'>
        <Label>{t('Minimum billable minutes')}</Label>
        <Input
          type='number'
          step='0.01'
          placeholder='0'
          value={value.min_bill_minutes || ''}
          onChange={(e) =>
            onChange({
              ...value,
              min_bill_minutes: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Minimum charge floor (e.g. 0.25 for 15-second minimum). Leave 0 to charge exact duration.'
          )}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AudioOutEditor (TTS)
// ---------------------------------------------------------------------------

const TTS_VOICE_SUGGESTIONS = ['nova', 'echo', 'alloy', 'onyx', 'shimmer', 'clone'] as const

type AudioOutEditorProps = {
  value: AudioOutPricing
  onChange: (next: AudioOutPricing) => void
  currencyLabel: string
}

export function AudioOutEditor({
  value,
  onChange,
  currencyLabel,
}: AudioOutEditorProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>
          {t('Price per 1M characters ({{unit}})', { unit: currencyLabel })}
        </Label>
        <Input
          type='number'
          step='0.01'
          placeholder='15.00'
          value={value.price_per_million_chars || ''}
          onChange={(e) =>
            onChange({
              ...value,
              price_per_million_chars: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t('Cost per 1,000,000 characters of TTS input (e.g. tts-1: $15/1M chars).')}
        </p>
      </div>

      <MultiplierMapEditor
        label={t('Voice multipliers')}
        hint={t(
          'Multiplier per voice / clone type (e.g. "clone" = 2×). Missing entries default to 1.'
        )}
        keyPlaceholder={t('voice (e.g. nova)')}
        keySuggestions={TTS_VOICE_SUGGESTIONS}
        value={value.voice_multipliers ?? {}}
        onChange={(m) => onChange({ ...value, voice_multipliers: m })}
      />
    </div>
  )
}
