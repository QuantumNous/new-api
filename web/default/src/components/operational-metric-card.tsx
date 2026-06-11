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

type OperationalTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface OperationalMetricCardProps {
  label: string
  value: ReactNode
  unit?: string
  description?: ReactNode
  icon?: ReactNode
  tone?: OperationalTone
  action?: ReactNode
  className?: string
}

const toneClassName: Record<OperationalTone, string> = {
  neutral: 'operator-rail-active',
  success: 'operator-rail-active',
  warning: 'operator-rail-warning',
  danger: 'operator-rail-danger',
  info: 'operator-rail-active',
}

export function OperationalMetricCard(props: OperationalMetricCardProps) {
  return (
    <div
      className={cn(
        'surface-console rounded-2xl border p-3 sm:p-4',
        toneClassName[props.tone ?? 'neutral'],
        props.className
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='operator-metric-label'>{props.label}</div>
          <div className='mt-2 flex min-w-0 items-baseline gap-1.5'>
            <div className='operator-number truncate text-2xl sm:text-3xl'>
              {props.value}
            </div>
            {props.unit != null && (
              <div className='text-muted-foreground shrink-0 text-xs font-medium'>
                {props.unit}
              </div>
            )}
          </div>
        </div>
        {props.icon != null && (
          <div className='bg-background/70 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl border'>
            {props.icon}
          </div>
        )}
      </div>
      {(props.description != null || props.action != null) && (
        <div className='mt-3 flex items-center justify-between gap-2'>
          {props.description != null && (
            <div className='text-muted-foreground min-w-0 truncate text-xs'>
              {props.description}
            </div>
          )}
          {props.action}
        </div>
      )}
    </div>
  )
}
