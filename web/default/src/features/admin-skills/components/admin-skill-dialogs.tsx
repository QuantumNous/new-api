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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  kidsStatusVariant,
  labelFromValue,
  skillPlanVariant,
  skillStatusVariant,
} from '../constants'
import type { AdminSkill } from '../types'

interface AdminSkillDialogProps {
  skill: AdminSkill | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminSkillPreviewDialog({
  skill,
  open,
  onOpenChange,
}: AdminSkillDialogProps) {
  const { t } = useTranslation()
  if (!skill) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{skill.name}</DialogTitle>
          <DialogDescription>{skill.short_description}</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
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
          {skill.description ? (
            <p className='text-muted-foreground text-sm leading-6'>
              {skill.description}
            </p>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No preview description is available.')}
            </p>
          )}
          <div className='grid gap-3 sm:grid-cols-2'>
            <PreviewField label={t('Slug')} value={skill.slug} />
            <PreviewField label={t('Category')} value={skill.category} />
            <PreviewField
              label={t('Active Version')}
              value={skill.active_version_id ?? t('None')}
            />
            <PreviewField
              label={t('Model Whitelist')}
              value={String(skill.model_whitelist?.length ?? 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            {t('Close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminSkillEditDialog({
  skill,
  open,
  onOpenChange,
}: AdminSkillDialogProps) {
  const { t } = useTranslation()
  if (!skill) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>{t('Edit Skill')}</DialogTitle>
          <DialogDescription>
            {t('Desktop editing is required for Skill administration.')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <PreviewField label={t('Skill')} value={skill.name} />
          <PreviewField label={t('Slug')} value={skill.slug} />
          <PreviewField
            label={t('Active Version')}
            value={skill.active_version_id ?? t('None')}
          />
          <p className='text-muted-foreground text-sm leading-6'>
            {t(
              'The edit form will attach to this Skill once the write API is available.'
            )}
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            {t('Close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-[7px] border bg-card px-3 py-2'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 truncate text-sm font-medium tabular-nums'>
        {value}
      </div>
    </div>
  )
}
