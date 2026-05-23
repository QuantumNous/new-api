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

/** Section switcher on dashboard (模型调用分析 / 账号分析) — dark ops style only. */
export const dashboardSectionTabsListClassName = cn(
  'group-data-horizontal/tabs:h-auto max-w-full flex-wrap justify-start gap-1 rounded-xl',
  'border border-white/10 bg-slate-900/70 p-1 shadow-sm shadow-black/25',
  '!bg-slate-900/70'
)

export const dashboardSectionTabsTriggerClassName = cn(
  'h-9 flex-none rounded-lg border border-transparent bg-transparent px-3 py-1.5',
  'text-sm font-medium text-slate-300 shadow-none transition-colors',
  'hover:bg-white/5 hover:text-white',
  'focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:outline-none',
  'data-active:border-cyan-300/40 data-active:bg-cyan-400/15 data-active:text-white',
  'data-active:shadow-sm data-active:ring-1 data-active:ring-cyan-400/20',
  'dark:text-slate-300 dark:hover:text-white',
  'dark:data-active:border-cyan-300/40 dark:data-active:bg-cyan-400/15 dark:data-active:text-white',
  'data-active:!bg-cyan-400/15 data-active:!text-white',
  'after:hidden group-data-[variant=line]/tabs-list:after:hidden'
)
