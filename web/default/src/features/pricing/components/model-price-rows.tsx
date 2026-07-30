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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type ModelPriceTone = 'input' | 'output' | 'cache' | 'default'

export interface ModelPriceRowItem {
  key: string
  label: string
  /** Pre-formatted price string including its currency symbol. */
  formatted: ReactNode
  tone?: ModelPriceTone
  /** Primary prices (input/output) render heavier than secondary ones. */
  emphasized?: boolean
}

const TONE_CLASSES: Record<ModelPriceTone, string> = {
  input: 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  output:
    'bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  cache: 'bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
  default: 'bg-muted text-muted-foreground',
}

/**
 * Row-based model price list: one scannable row per price type with a
 * colored label chip on the left and an Arial (`font-price`) price plus
 * unit suffix on the right. Shared by the marketplace card and the model
 * details view so both render prices with the same layout and font.
 */
export function ModelPriceRows(props: {
  items: ModelPriceRowItem[]
  /** Appended to every price, e.g. `/1M` for token-based models. */
  unitSuffix?: string
  className?: string
}) {
  return (
    <div className={cn('font-price space-y-1.5', props.className)}>
      {props.items.map((item) => (
        <div key={item.key} className='flex items-center justify-between gap-3'>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium',
              TONE_CLASSES[item.tone ?? 'default']
            )}
          >
            {item.label}
          </span>
          <span
            className={cn(
              'whitespace-nowrap tabular-nums',
              item.emphasized
                ? 'text-foreground text-sm font-semibold sm:text-[15px]'
                : 'text-muted-foreground text-sm font-medium'
            )}
          >
            {item.formatted}
            {props.unitSuffix && (
              <span className='text-muted-foreground/50 text-[11px] font-normal'>
                {props.unitSuffix}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
