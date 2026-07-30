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

import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL } from '../constants'
import { compareVendorNames } from '../lib/model-helpers'
import type { PricingVendor } from '../types'

export interface VendorPillsProps {
  /** Vendors that actually have visible models, unsorted. */
  vendors: PricingVendor[]
  value: string
  onChange: (value: string) => void
}

/**
 * One-row vendor quick filter: horizontally scrollable pills in the same
 * order as the card grid's vendor sections. Clicking the active pill
 * resets back to all vendors.
 */
export function VendorPills(props: VendorPillsProps) {
  const { t } = useTranslation()
  const vendors = [...props.vendors].sort((a, b) =>
    compareVendorNames(a.name, b.name)
  )

  const pillClassName = (active: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-ui',
      active
        ? 'border-primary/40 bg-primary/10 text-primary'
        : 'border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground'
    )

  return (
    <div
      role='group'
      aria-label={t('All Vendors')}
      className='no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1'
    >
      <button
        type='button'
        aria-pressed={props.value === FILTER_ALL}
        onClick={() => props.onChange(FILTER_ALL)}
        className={pillClassName(props.value === FILTER_ALL)}
      >
        {t('All Vendors')}
      </button>
      {vendors.map((vendor) => {
        const active = props.value === vendor.name
        return (
          <button
            key={vendor.id}
            type='button'
            aria-pressed={active}
            onClick={() => props.onChange(active ? FILTER_ALL : vendor.name)}
            className={pillClassName(active)}
          >
            {vendor.icon && (
              <span aria-hidden className='shrink-0'>
                {getLobeIcon(vendor.icon, 14)}
              </span>
            )}
            {vendor.name}
          </button>
        )
      })}
    </div>
  )
}
