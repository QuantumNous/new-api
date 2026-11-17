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
import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  type DashboardMetric,
  type DashboardMetricArea,
  useDashboardMetricStore,
} from '@/stores/dashboard-metric-store'

const METRIC_OPTIONS = [
  { value: 'quota' as const, labelKey: 'Amount', Icon: Coins },
  { value: 'tokens' as const, labelKey: 'By tokens', Icon: Layers },
]

interface MetricToggleProps {
  area: DashboardMetricArea
  className?: string
}

export function MetricToggle({ area, className }: MetricToggleProps) {
  const { t } = useTranslation()
  const metric = useDashboardMetricStore((state) => state[area])
  const setMetric = useDashboardMetricStore((state) => state.setMetric)

  return (
    <ToggleGroup
      value={[metric]}
      onValueChange={(values) => {
        if (values.length > 0) {
          setMetric(area, values[0] as DashboardMetric)
        }
      }}
      className={cn(
        'bg-muted/40 ring-border/60 h-8 shrink-0 gap-0 rounded-full p-0.5 ring-1',
        className
      )}
      aria-label={t('Display mode')}
    >
      {METRIC_OPTIONS.map(({ value: optionValue, labelKey, Icon }) => {
        const active = metric === optionValue
        return (
          <ToggleGroupItem
            key={optionValue}
            value={optionValue}
            className={cn(
              'h-7 gap-1.5 rounded-full border-0 px-3 text-xs font-medium whitespace-nowrap shadow-none transition-all duration-200 hover:bg-transparent',
              active
                ? 'bg-background text-foreground ring-border/60 aria-pressed:bg-background data-[state=on]:bg-background hover:bg-background shadow-sm ring-1'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'size-3.5',
                active ? 'text-primary' : 'text-muted-foreground/70'
              )}
            />
            {t(labelKey)}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
