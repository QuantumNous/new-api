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
import { Coins, Layers } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type MetricMode = 'quota' | 'tokens'

const METRIC_STORAGE_FALLBACK: MetricMode = 'quota'

function readStoredMetric(storageKey: string): MetricMode {
  if (typeof window === 'undefined') return METRIC_STORAGE_FALLBACK
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'quota' || stored === 'tokens') return stored
  } catch {
    // localStorage can be unavailable in restricted contexts
  }
  return METRIC_STORAGE_FALLBACK
}

/**
 * Remembers the last selected metric mode for a given storage key, so the
 * dashboard reopens in the mode the user used last instead of always Amount.
 */
export function useMetricMode(
  storageKey: string,
  fallback: MetricMode = METRIC_STORAGE_FALLBACK
): [MetricMode, (value: MetricMode) => void] {
  const [metric, setMetric] = useState<MetricMode>(() =>
    readStoredMetric(storageKey)
  )

  const update = useCallback(
    (value: MetricMode) => {
      setMetric(value)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, value)
        } catch {
          // ignore quota / security errors, the in-memory state still applies
        }
      }
    },
    [storageKey]
  )

  return [metric, update]
}

const METRIC_OPTIONS = [
  { value: 'quota' as const, labelKey: 'Amount', Icon: Coins },
  { value: 'tokens' as const, labelKey: 'By tokens', Icon: Layers },
]

interface MetricToggleProps {
  value: MetricMode
  onChange: (value: MetricMode) => void
  className?: string
}

export function MetricToggle({ value, onChange, className }: MetricToggleProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'bg-muted/40 ring-border/60 inline-flex h-8 shrink-0 items-center rounded-full p-0.5 ring-1',
        className
      )}
      role='group'
      aria-label={t('Display mode')}
    >
      {METRIC_OPTIONS.map(({ value: optionValue, labelKey, Icon }) => {
        const active = value === optionValue
        return (
          <button
            key={optionValue}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-all duration-200',
              active
                ? 'bg-background text-foreground ring-border/60 shadow-sm ring-1'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'size-3.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground/70'
              )}
            />
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
