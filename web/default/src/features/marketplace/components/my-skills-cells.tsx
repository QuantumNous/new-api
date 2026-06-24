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
import { useState } from 'react'
import { AlertTriangle, CircleCheck, Play, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MySkill } from '../types'
import type { MySkillRowView } from '../lib/my-skills-row-state'
import { LockState } from './lock-state'

/**
 * Status cell shared by the desktop table and the mobile list. Renders the
 * lock reason for locked rows, an "Available" badge otherwise, and — always,
 * independently — the deprecated warning when `isDeprecated`.
 */
export function MySkillStatus({ view }: { view: MySkillRowView }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-1'>
      {view.lockReason != null ? (
        <LockState state={view.lockReason} />
      ) : view.rowState === 'deprecated' ? (
        <Badge
          variant='outline'
          aria-label={t('Status: {{status}}', { status: t('Deprecated') })}
        >
          <AlertTriangle data-icon='inline-start' />
          {t('Deprecated')}
        </Badge>
      ) : (
        <Badge
          variant='secondary'
          aria-label={t('Status: {{status}}', {
            status: t(view.statusLabelKey),
          })}
        >
          <CircleCheck data-icon='inline-start' />
          {t('Available')}
        </Badge>
      )}
      {view.isDeprecated && view.warningKey != null && (
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <AlertTriangle className='size-3.5 shrink-0' aria-hidden='true' />
          {t(view.warningKey)}
        </span>
      )}
    </div>
  )
}

interface MySkillActionsProps {
  skill: MySkill
  view: MySkillRowView
  removing: boolean
  onUse: (skill: MySkill) => void
  onRemove: (skill: MySkill) => void
}

/**
 * Action cell: a Use button only for truly executable rows (navigation only —
 * never executes, never emits usage analytics) plus Remove with a confirm
 * dialog (DR-56). Locked rows render no clickable primary CTA, because the
 * skill surface has no wired plan-upgrade / renew flow.
 */
export function MySkillActions({
  skill,
  view,
  removing,
  onUse,
  onRemove,
}: MySkillActionsProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {view.canUse && (
        <Button
          type='button'
          size='sm'
          className='min-w-20'
          onClick={() => onUse(skill)}
        >
          <Play data-icon='inline-start' />
          {t('Use')}
        </Button>
      )}
      <Button
        type='button'
        size='sm'
        variant='destructive'
        disabled={removing}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 data-icon='inline-start' />
        {t('Remove from My Skills')}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Remove from My Skills?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Remove this skill from My Skills? This changes your library and hides the row from this page.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                // Close the dialog deterministically on confirm; success unmounts
                // the row after refetch, failure surfaces a toast (row stays).
                setConfirmOpen(false)
                onRemove(skill)
              }}
            >
              {t('Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
