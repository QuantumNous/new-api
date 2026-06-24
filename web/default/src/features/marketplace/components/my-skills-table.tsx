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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MySkill } from '../types'
import {
  formatMySkillDate,
  skillKey,
  type MySkillRowItem,
} from '../lib/my-skills-row-state'
import { PlanBadge } from './badges'
import { MySkillActions, MySkillStatus } from './my-skills-cells'

interface MySkillsTableProps {
  rows: MySkillRowItem[]
  removingId: string | null
  onOpen: (skill: MySkill) => void
  onUse: (skill: MySkill) => void
  onRemove: (skill: MySkill) => void
}

export function MySkillsTable({
  rows,
  removingId,
  onOpen,
  onUse,
  onRemove,
}: MySkillsTableProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableCaption className='sr-only'>
        {t('Skills in My Skills, with their status and actions.')}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Skill')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Required plan')}</TableHead>
          <TableHead>{t('Last used')}</TableHead>
          <TableHead>{t('Enabled')}</TableHead>
          <TableHead className='text-right'>{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ skill, view }) => {
          const id = skillKey(skill)
          const lastUsed = formatMySkillDate(skill.last_used_at)
          const enabledAt = formatMySkillDate(skill.enabled_at)
          return (
            <TableRow key={id}>
              <TableCell>
                {view.canOpen ? (
                  <button
                    type='button'
                    className='hover:text-primary text-left font-medium underline-offset-2 hover:underline'
                    onClick={() => onOpen(skill)}
                  >
                    {skill.name}
                  </button>
                ) : (
                  // Deprecated/archived: Skill Detail is published-only, so the
                  // name is plain text (navigating would dead-end at a 404).
                  <span className='font-medium'>{skill.name}</span>
                )}
                {skill.category != null && skill.category !== '' && (
                  <div className='text-muted-foreground text-xs'>
                    {skill.category}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <MySkillStatus view={view} />
              </TableCell>
              <TableCell>
                <PlanBadge plan={skill.required_plan} />
              </TableCell>
              <TableCell className='text-muted-foreground text-sm'>
                {lastUsed ?? t('Never')}
              </TableCell>
              <TableCell className='text-muted-foreground text-sm'>
                {enabledAt ?? '—'}
              </TableCell>
              <TableCell>
                <MySkillActions
                  skill={skill}
                  view={view}
                  removing={removingId === id}
                  onUse={onUse}
                  onRemove={onRemove}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
