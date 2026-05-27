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
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ModelStatusFilter, ModelStatusHealth } from '../types'

const statusOptions: Array<{ value: ModelStatusFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'All' },
  { value: 'up', labelKey: 'Healthy' },
  { value: 'degraded', labelKey: 'Degraded' },
  { value: 'down', labelKey: 'Unavailable' },
  { value: 'unknown', labelKey: 'Unknown' },
]

export function StatusFilterBar(props: {
  groupNames: string[]
  selectedGroup: string
  selectedStatus: ModelStatusFilter
  search: string
  onGroupChange: (value: string) => void
  onStatusChange: (value: ModelStatusFilter) => void
  onSearchChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <section
      className='bg-card/90 rounded-2xl border p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75'
      aria-label={t('Model status filters')}
    >
      <div className='grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)_auto] xl:items-center'>
        <label className='relative min-w-0'>
          <span className='sr-only'>{t('Search models')}</span>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <Input
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder={t('Search models...')}
            className='h-10 pl-9'
          />
        </label>

        <div
          className='scrollbar-thin flex min-w-0 gap-2 overflow-x-auto pb-1'
          aria-label={t('Filter by group')}
        >
          <FilterButton
            active={props.selectedGroup === 'all'}
            onClick={() => props.onGroupChange('all')}
          >
            {t('All Groups')}
          </FilterButton>
          {props.groupNames.map((group) => (
            <FilterButton
              key={group}
              active={props.selectedGroup === group}
              onClick={() => props.onGroupChange(group)}
            >
              {group}
            </FilterButton>
          ))}
        </div>

        <div
          className='scrollbar-thin flex gap-2 overflow-x-auto pb-1 xl:justify-end'
          aria-label={t('Filter by status')}
        >
          {statusOptions.map((option) => (
            <FilterButton
              key={option.value}
              active={props.selectedStatus === option.value}
              tone={option.value === 'all' ? undefined : option.value}
              onClick={() => props.onStatusChange(option.value)}
            >
              {t(option.labelKey)}
            </FilterButton>
          ))}
        </div>
      </div>
    </section>
  )
}

function FilterButton(props: {
  active: boolean
  children: ReactNode
  tone?: ModelStatusHealth
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant={props.active ? 'default' : 'outline'}
      size='sm'
      onClick={props.onClick}
      className={cn(
        'h-8 shrink-0 rounded-full px-3 text-xs',
        props.tone === 'degraded' &&
          !props.active &&
          'border-amber-500/30 text-amber-700 dark:text-amber-300',
        props.tone === 'down' &&
          !props.active &&
          'border-red-500/30 text-red-700 dark:text-red-300',
        props.tone === 'up' &&
          !props.active &&
          'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
      )}
    >
      {props.children}
    </Button>
  )
}
