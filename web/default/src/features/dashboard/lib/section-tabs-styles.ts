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

/** Section switcher on dashboard (模型调用分析 / 账号分析) — light ops console. */
export const dashboardSectionTabsListClassName = cn(
  'group-data-horizontal/tabs:h-auto max-w-full flex-wrap justify-start gap-1 rounded-xl',
  'border border-[#DBEAFE] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  '!bg-white'
)

export const dashboardSectionTabsTriggerClassName = cn(
  'h-9 flex-none rounded-lg border border-transparent bg-transparent px-3 py-1.5',
  'text-sm font-medium text-slate-600 shadow-none transition-colors',
  'hover:bg-blue-50/70 hover:text-blue-700',
  'focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:outline-none',
  'data-active:border-blue-200/80 data-active:bg-blue-50 data-active:text-blue-700',
  'data-active:shadow-none data-active:ring-1 data-active:ring-blue-200/60',
  'data-active:!bg-blue-50 data-active:!text-blue-700',
  'after:hidden group-data-[variant=line]/tabs-list:after:hidden'
)
