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
import { Card, CardContent } from '@/components/ui/card'
import type { MySkill } from '../types'
import {
  formatMySkillDate,
  skillKey,
  type MySkillRowItem,
} from '../lib/my-skills-row-state'
import { PlanBadge } from './badges'
import { MySkillActions, MySkillStatus } from './my-skills-cells'

interface MySkillsMobileListProps {
  rows: MySkillRowItem[]
  removingId: string | null
  onOpen: (skill: MySkill) => void
  onUse: (skill: MySkill) => void
  onRemove: (skill: MySkill) => void
}

export function MySkillsMobileList({
  rows,
  removingId,
  onOpen,
  onUse,
  onRemove,
}: MySkillsMobileListProps) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-3'>
      {rows.map(({ skill, view }) => {
        const id = skillKey(skill)
        const lastUsed = formatMySkillDate(skill.last_used_at)
        const enabledAt = formatMySkillDate(skill.enabled_at)
        return (
          <Card key={id}>
            <CardContent className='flex flex-col gap-3 p-4'>
              <div className='flex items-start justify-between gap-2'>
                {view.canOpen ? (
                  <button
                    type='button'
                    className='hover:text-primary text-left font-medium underline-offset-2 hover:underline'
                    onClick={() => onOpen(skill)}
                  >
                    {skill.name}
                  </button>
                ) : (
                  // Deprecated/archived: Skill Detail is published-only.
                  <span className='font-medium'>{skill.name}</span>
                )}
                <PlanBadge plan={skill.required_plan} />
              </div>
              <MySkillStatus view={view} />
              <div className='text-muted-foreground flex flex-col gap-0.5 text-xs'>
                <span>
                  {t('Last used')}: {lastUsed ?? t('Never')}
                </span>
                <span>
                  {t('Enabled')}: {enabledAt ?? '—'}
                </span>
              </div>
              <MySkillActions
                skill={skill}
                view={view}
                removing={removingId === id}
                onUse={onUse}
                onRemove={onRemove}
              />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
