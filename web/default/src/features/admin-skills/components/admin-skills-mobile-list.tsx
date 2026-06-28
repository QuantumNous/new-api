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
import { type Table } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import {
  kidsStatusVariant,
  labelFromValue,
  skillPlanVariant,
  skillStatusVariant,
} from '../constants'
import type { AdminSkill } from '../types'

interface AdminSkillsMobileListProps {
  table: Table<AdminSkill>
  isLoading?: boolean
  onPreview: (skill: AdminSkill) => void
}

export function AdminSkillsMobileList({
  table,
  isLoading,
  onPreview,
}: AdminSkillsMobileListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-36 rounded-[7px]' />
        ))}
      </div>
    )
  }

  const rows = table.getRowModel().rows
  if (rows.length === 0) {
    return (
      <div className='bg-card rounded-[7px] border p-6 text-center'>
        <div className='font-medium'>{t('No Skills Found')}</div>
        <div className='text-muted-foreground mt-1 text-sm'>
          {t('No admin skills match the selected filters.')}
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {rows.map((row) => {
        const skill = row.original
        return (
          <article key={skill.id} className='bg-card rounded-[7px] border p-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate font-medium'>{skill.name}</div>
                <div className='text-muted-foreground mt-1 truncate text-xs'>
                  {skill.category} / {skill.slug}
                </div>
              </div>
              <Button
                variant='outline'
                size='icon-sm'
                onClick={() => onPreview(skill)}
                aria-label={t('Preview Skill')}
              >
                <Eye className='size-4' />
              </Button>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
              <StatusBadge
                label={t(labelFromValue(skill.status))}
                variant={skillStatusVariant[skill.status]}
                copyable={false}
              />
              <StatusBadge
                label={t(labelFromValue(skill.required_plan))}
                variant={skillPlanVariant[skill.required_plan]}
                copyable={false}
              />
              <StatusBadge
                label={t(labelFromValue(skill.kids_approval_status))}
                variant={kidsStatusVariant[skill.kids_approval_status]}
                copyable={false}
              />
            </div>
            <div className='text-muted-foreground mt-3 grid grid-cols-2 gap-2 text-xs'>
              <div>
                {t('Featured')}: {skill.featured_flag ? t('Yes') : t('No')}
              </div>
              <div>
                {t('Downloads')}: {skill.downloads_7d ?? 0} /{' '}
                {skill.downloads_30d ?? 0}
              </div>
              <div className='truncate'>
                {t('Version')}: {skill.active_version_id ?? t('None')}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
