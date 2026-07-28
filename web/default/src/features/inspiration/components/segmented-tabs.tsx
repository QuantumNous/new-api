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
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type SegmentedTabOption<T extends string> = {
  value: T
  label: string
  icon?: LucideIcon
}

type SegmentedTabsProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentedTabOption<T>>
  ariaLabel: string
  className?: string
}

/**
 * Shared segmented control for the inspiration surfaces (landing sections and
 * template series). Single source for the muted track + raised active item.
 */
export function SegmentedTabs<T extends string>(props: SegmentedTabsProps<T>) {
  const { t } = useTranslation()
  return (
    <div
      role='tablist'
      aria-label={props.ariaLabel}
      className={cn(
        'bg-muted/60 inline-flex shrink-0 items-center gap-0.5 rounded-lg p-1',
        props.className
      )}
    >
      {props.options.map((option) => (
        <button
          key={option.value}
          type='button'
          role='tab'
          aria-selected={props.value === option.value}
          onClick={() => props.onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-ring focus-visible:ring-2',
            props.value === option.value
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.icon ? (
            <option.icon className='size-4' aria-hidden='true' />
          ) : null}
          {t(option.label)}
        </button>
      ))}
    </div>
  )
}
