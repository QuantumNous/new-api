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
import { type ColumnDef } from '@tanstack/react-table'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import {
  kidsStatusVariant,
  labelFromValue,
  skillPlanVariant,
  skillStatusVariant,
} from '../constants'
import type { AdminSkill } from '../types'
import { AdminSkillIcon } from './admin-skill-icon'
import { AdminSkillRowActions } from './admin-skill-row-actions'

interface UseAdminSkillsColumnsProps {
  onEdit: (skill: AdminSkill) => void
  onPreview: (skill: AdminSkill) => void
}

export function useAdminSkillsColumns({
  onEdit,
  onPreview,
}: UseAdminSkillsColumnsProps): ColumnDef<AdminSkill>[] {
  const { t } = useTranslation()

  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Skill')} />
      ),
      cell: ({ row }) => {
        const skill = row.original
        return (
          <div className='flex min-w-[220px] items-center gap-3'>
            <AdminSkillIcon skill={skill} />
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <LongText className='max-w-[220px] font-medium'>
                  {skill.name}
                </LongText>
                {skill.featured_flag && (
                  <Star className='text-warning size-3.5 fill-current' />
                )}
              </div>
              <div className='text-muted-foreground mt-1 flex items-center gap-2 text-xs'>
                <span>{skill.category}</span>
                <span aria-hidden='true'>/</span>
                <LongText className='max-w-[160px]'>{skill.slug}</LongText>
              </div>
            </div>
          </div>
        )
      },
      enableHiding: false,
      meta: { label: t('Skill'), mobileTitle: true },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <StatusBadge
            label={t(labelFromValue(status))}
            variant={skillStatusVariant[status]}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      meta: { label: t('Status'), mobileBadge: true },
    },
    {
      accessorKey: 'required_plan',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Required Plan')} />
      ),
      cell: ({ row }) => {
        const plan = row.original.required_plan
        return (
          <StatusBadge
            label={t(labelFromValue(plan))}
            variant={skillPlanVariant[plan]}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      meta: { label: t('Required Plan'), mobileBadge: true },
    },
    {
      accessorKey: 'kids_approval_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Kids Status')} />
      ),
      cell: ({ row }) => {
        const kidsStatus = row.original.kids_approval_status
        return (
          <div className='flex flex-col gap-1'>
            <StatusBadge
              label={t(labelFromValue(kidsStatus))}
              variant={kidsStatusVariant[kidsStatus]}
              copyable={false}
            />
            {(row.original.is_kids_safe || row.original.is_kids_exclusive) && (
              <span className='text-muted-foreground text-xs'>
                {row.original.is_kids_exclusive
                  ? t('Kids exclusive')
                  : t('Kids safe')}
              </span>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      meta: { label: t('Kids Status'), mobileBadge: true },
    },
    {
      id: 'featured',
      accessorKey: 'featured_flag',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Featured')} />
      ),
      cell: ({ row }) => {
        const skill = row.original
        return skill.featured_flag ? (
          <div className='flex flex-col gap-1'>
            <StatusBadge
              label={t('Featured')}
              variant='warning'
              icon={Star}
              showDot={false}
              copyable={false}
            />
            <span className='text-muted-foreground text-xs tabular-nums'>
              {t('Rank {{rank}}', {
                rank: skill.featured_rank ?? '-',
              })}
            </span>
          </div>
        ) : (
          <StatusBadge label={t('No')} variant='neutral' copyable={false} />
        )
      },
      meta: { label: t('Featured') },
    },
    {
      accessorKey: 'active_version_id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Active Version')} />
      ),
      cell: ({ row }) => (
        <LongText className='max-w-[160px] text-xs font-medium tabular-nums'>
          {row.original.active_version_id ?? t('None')}
        </LongText>
      ),
      meta: { label: t('Active Version'), mobileHidden: true },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Last Updated')} />
      ),
      cell: ({ row }) => {
        const skill = row.original
        const actor = skill.updated_by ?? skill.created_by
        return (
          <div className='min-w-[150px]'>
            <div className='text-sm tabular-nums'>
              {dayjs(skill.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            <div className='text-muted-foreground mt-1 text-xs tabular-nums'>
              {t('Actor #{{id}}', { id: actor })}
            </div>
          </div>
        )
      },
      meta: { label: t('Last Updated') },
    },
    {
      id: 'actions',
      header: () => <div className='text-right'>{t('Actions')}</div>,
      cell: ({ row }) => (
        <AdminSkillRowActions
          row={row}
          onEdit={onEdit}
          onPreview={onPreview}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { label: t('Actions'), mobileHidden: true },
    },
  ]
}
