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
import { Loader2, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import {
  useOfficialPricing,
  type OfficialPricing,
} from '../../hooks/use-official-pricing'

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export type OfficialPricingApply = {
  ratio?: number
  completionRatio?: number
  cacheRatio?: number
  imageRatio?: number
  audioRatio?: number
  audioCompletionRatio?: number
  modelPrice?: number
}

type OfficialPricingReferenceProps = {
  modelName: string | undefined | null
  pricingMode: 'per-token' | 'per-request'
  /**
   * Current form values (USD-anchored ratios / model_price) — used to detect
   * whether "apply" would overwrite user edits so we can prompt first.
   */
  current: {
    ratio?: string
    completionRatio?: string
    cacheRatio?: string
    imageRatio?: string
    audioRatio?: string
    audioCompletionRatio?: string
    price?: string
  }
  onApply: (values: OfficialPricingApply) => void
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function OfficialPricingReference({
  modelName,
  pricingMode,
  current,
  onApply,
}: OfficialPricingReferenceProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useOfficialPricing(modelName)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const applyPayload = useMemo<OfficialPricingApply | null>(
    () => buildApplyPayload(data, pricingMode),
    [data, pricingMode]
  )

  const overwrittenFields = useMemo(
    () => (applyPayload ? findOverwrites(current, applyPayload) : []),
    [current, applyPayload]
  )

  if (!modelName) return null

  if (isLoading) {
    return (
      <div className='bg-muted/40 flex items-center gap-2 rounded-md border p-3 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        <span>{t('Loading official price...')}</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className='bg-muted/40 text-muted-foreground rounded-md border p-3 text-sm'>
        {t('No official price available for this model.')}
      </div>
    )
  }

  const canApply = applyPayload !== null

  return (
    <>
      <div className='bg-muted/40 flex flex-col gap-2 rounded-md border p-3 text-sm'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>{t('Official reference price')}</Badge>
            <span className='text-muted-foreground text-xs'>
              {t('Source: {{source}}', {
                source:
                  data.source === 'official'
                    ? 'basellm.github.io'
                    : 'models.dev',
              })}
            </span>
          </div>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={!canApply}
            onClick={() => {
              if (overwrittenFields.length > 0) {
                setConfirmOpen(true)
              } else if (applyPayload) {
                onApply(applyPayload)
              }
            }}
          >
            <RefreshCcw className='mr-1 h-3 w-3' />
            {t('Apply official price')}
          </Button>
        </div>
        <ReferenceRows data={data} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Overwrite existing values?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Some pricing fields already have values that differ from the official price. Applying will overwrite them.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (applyPayload) onApply(applyPayload)
                setConfirmOpen(false)
              }}
            >
              {t('Apply official price')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// -----------------------------------------------------------------------------
// Row rendering
// -----------------------------------------------------------------------------

function ReferenceRows({ data }: { data: OfficialPricing }) {
  const { t } = useTranslation()
  const cells: Array<{
    label: string
    usd: number | undefined
    per: 'M' | 'req'
  }> = []

  if (data.modelRatio !== undefined) {
    const inputUSD = data.modelRatio * 2
    cells.push({ label: t('Input'), usd: inputUSD, per: 'M' })
    if (data.completionRatio !== undefined) {
      cells.push({
        label: t('Output'),
        usd: inputUSD * data.completionRatio,
        per: 'M',
      })
    }
    if (data.cacheRatio !== undefined) {
      cells.push({
        label: t('Cache'),
        usd: inputUSD * data.cacheRatio,
        per: 'M',
      })
    }
    if (data.imageRatio !== undefined) {
      cells.push({
        label: t('Image'),
        usd: inputUSD * data.imageRatio,
        per: 'M',
      })
    }
    if (data.audioRatio !== undefined) {
      cells.push({
        label: t('Audio input'),
        usd: inputUSD * data.audioRatio,
        per: 'M',
      })
    }
    if (
      data.audioRatio !== undefined &&
      data.audioCompletionRatio !== undefined
    ) {
      cells.push({
        label: t('Audio output'),
        usd: inputUSD * data.audioRatio * data.audioCompletionRatio,
        per: 'M',
      })
    }
  }
  if (data.modelPrice !== undefined) {
    cells.push({ label: t('Per request'), usd: data.modelPrice, per: 'req' })
  }

  return (
    <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
      {cells.map((c) => (
        <span key={c.label} className='whitespace-nowrap'>
          <span className='text-muted-foreground'>{c.label}:</span>{' '}
          <span className='font-medium'>
            {formatBillingCurrencyFromUSD(c.usd, {
              abbreviate: false,
              digitsLarge: 4,
              digitsSmall: 4,
            })}
          </span>
          <span className='text-muted-foreground'>
            {c.per === 'M' ? ' / 1M' : ' / req'}
          </span>
        </span>
      ))}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Build the payload we would write into the form when the user clicks Apply.
 * Returns null when the current pricing mode is incompatible with what the
 * upstream provides (e.g. per-request mode but upstream only knows ratios).
 */
function buildApplyPayload(
  data: OfficialPricing | null,
  pricingMode: 'per-token' | 'per-request'
): OfficialPricingApply | null {
  if (!data) return null
  if (pricingMode === 'per-request') {
    if (data.modelPrice === undefined) return null
    return { modelPrice: data.modelPrice }
  }
  if (data.modelRatio === undefined) return null
  return {
    ratio: data.modelRatio,
    completionRatio: data.completionRatio,
    cacheRatio: data.cacheRatio,
    imageRatio: data.imageRatio,
    audioRatio: data.audioRatio,
    audioCompletionRatio: data.audioCompletionRatio,
  }
}

/**
 * List the fields where the current form value is non-empty and differs from
 * the official value by more than a hairline (1e-6). Used to decide whether
 * to prompt for confirmation before overwriting.
 */
function findOverwrites(
  current: OfficialPricingReferenceProps['current'],
  payload: OfficialPricingApply
): string[] {
  const eps = 1e-6
  const checks: Array<[keyof OfficialPricingApply, string | undefined]> = [
    ['ratio', current.ratio],
    ['completionRatio', current.completionRatio],
    ['cacheRatio', current.cacheRatio],
    ['imageRatio', current.imageRatio],
    ['audioRatio', current.audioRatio],
    ['audioCompletionRatio', current.audioCompletionRatio],
    ['modelPrice', current.price],
  ]
  const conflicts: string[] = []
  for (const [key, raw] of checks) {
    const incoming = payload[key]
    if (incoming === undefined) continue
    if (!raw || raw === '') continue
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) continue
    if (Math.abs(parsed - incoming) > eps) conflicts.push(key)
  }
  return conflicts
}
