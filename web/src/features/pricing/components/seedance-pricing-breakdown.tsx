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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  formatSeedancePerSecond,
  seedanceDisplayResolutions,
} from '../lib/seedance-price'
import type { PricingModel } from '../types'

type SeedancePricingBreakdownProps = {
  model: PricingModel
  showWithRecharge?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatio?: number
  compact?: boolean
}

export function SeedancePricingBreakdown({
  model,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio = 1,
  compact = false,
}: SeedancePricingBreakdownProps) {
  const { t } = useTranslation()
  const seedance = model.seedance
  if (!seedance) return null

  const resolutions = seedanceDisplayResolutions(model)
  const perSecondTable = seedance.super_resolution
    ? {
        text: seedance.output_text_per_second_usd,
        video: seedance.output_video_per_second_usd,
      }
    : {
        text: seedance.text_per_second_usd,
        video: seedance.video_per_second_usd,
      }

  const formatUsd = (usd?: number) =>
    formatSeedancePerSecond(usd, {
      showWithRecharge,
      priceRate,
      usdExchangeRate,
      groupRatio,
    }) || '—'

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <div className='overflow-x-auto rounded-lg border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/40 text-muted-foreground text-xs'>
            <tr>
              <th className='px-3 py-2 text-left font-medium'>
                {t('Resolution')}
              </th>
              <th className='px-3 py-2 text-right font-medium'>
                {t('No video input')}
              </th>
              <th className='px-3 py-2 text-right font-medium'>
                {t('With video input')}
              </th>
            </tr>
          </thead>
          <tbody>
            {resolutions.map((resolution) => (
              <tr key={resolution} className='border-t'>
                <td className='px-3 py-2 font-mono text-xs uppercase'>
                  {resolution === '4k' ? '4K' : resolution}
                </td>
                <td className='px-3 py-2 text-right font-mono tabular-nums'>
                  {formatUsd(perSecondTable.text?.[resolution])}
                  <span className='text-muted-foreground/50 ml-1 text-[10px]'>
                    / {t('sec')}
                  </span>
                </td>
                <td className='px-3 py-2 text-right font-mono tabular-nums'>
                  {formatUsd(perSecondTable.video?.[resolution])}
                  <span className='text-muted-foreground/50 ml-1 text-[10px]'>
                    / {t('sec')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='text-muted-foreground space-y-1 text-xs leading-relaxed'>
        <p>
          {t(
            'Token count = (width × height × 24 × seconds) / 1024. Cost = tokens / 1,000,000 × unit price. Displayed per-second prices use 16:9.'
          )}
        </p>
        {seedance.super_resolution ? (
          <p>
            {t(
              'MediaKit billing = source-resolution token cost + super-resolution per-second price × duration. 720p uses 480p generation; 1080p uses 720p generation.'
            )}
          </p>
        ) : (
          <p>
            {t(
              'Regular Seedance channels bill the output resolution token price. Actual settlement uses upstream token usage.'
            )}
          </p>
        )}
      </div>
    </div>
  )
}
