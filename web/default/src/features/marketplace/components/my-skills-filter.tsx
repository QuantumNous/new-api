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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MySkillFilter } from '../lib/my-skills-row-state'

export interface MySkillFilterCounts {
  all: number
  available: number
  locked: number
  deprecated: number
}

interface MySkillsFilterProps {
  value: MySkillFilter
  counts: MySkillFilterCounts
  onChange: (filter: MySkillFilter) => void
}

const FILTERS: { value: MySkillFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'locked', label: 'Locked' },
  { value: 'deprecated', label: 'Deprecated' },
]

export function MySkillsFilter({
  value,
  counts,
  onChange,
}: MySkillsFilterProps) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-1'>
      <Tabs
        value={value}
        onValueChange={(next) => onChange(next as MySkillFilter)}
      >
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {t(f.label)}
              <span className='text-muted-foreground ml-1 tabular-nums'>
                {counts[f.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {value === 'locked' && (
        <p className='text-muted-foreground text-xs'>
          {t('Plan, quota, kids-mode, or unavailable Skills.')}
        </p>
      )}
    </div>
  )
}
