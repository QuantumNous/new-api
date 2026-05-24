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
import { cn } from '@/lib/utils'
import { healthText } from '../lib/format'
import type { ModelStatusHealth } from '../types'

const healthClassName: Record<ModelStatusHealth, string> = {
  up: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  degraded:
    'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  down: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300',
  unknown:
    'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
}

export function StatusPill(props: { health: ModelStatusHealth }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        healthClassName[props.health]
      )}
    >
      <span className='size-1.5 rounded-full bg-current' aria-hidden />
      {healthText(props.health)}
    </span>
  )
}
