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

import { CAPABILITY_TABS, type CapabilityTabValue } from '../lib/capabilities'

export interface CapabilityTabsProps {
  value: CapabilityTabValue
  onChange: (value: CapabilityTabValue) => void
  counts?: Record<CapabilityTabValue, number>
}

export function CapabilityTabs(props: CapabilityTabsProps) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {CAPABILITY_TABS.map((tab) => {
        const active = props.value === tab.value
        const count = props.counts?.[tab.value]
        return (
          <button
            key={tab.value}
            type='button'
            onClick={() => props.onChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
              active
                ? 'border-foreground/30 bg-foreground/5 text-foreground shadow-sm'
                : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            {t(tab.labelKey)}
            {count != null && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px]',
                  active
                    ? 'bg-background text-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
